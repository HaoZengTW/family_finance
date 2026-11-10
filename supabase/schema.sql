begin;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
create table public.household_members (
  user_id uuid primary key references auth.users(id),
  household_id uuid not null references public.households(id),
  owner text not null check (owner in ('me', 'wife')),
  unique (household_id, owner)
);
create table public.ledger_batches (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id),
  request_id uuid not null,
  recorded_by text not null check (recorded_by in ('me', 'wife')),
  owner text not null check (owner in ('me', 'wife', 'joint')),
  trade_date date not null,
  items jsonb not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text check (voided_by in ('me', 'wife')),
  unique (household_id, request_id)
);
create index ledger_replay on public.ledger_batches (household_id, trade_date, id)
  where voided_at is null;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.ledger_batches enable row level security;
revoke all on public.households, public.household_members, public.ledger_batches from public, anon, authenticated;
grant select on public.household_members, public.ledger_batches to authenticated;
create policy member_self on public.household_members for select to authenticated using (user_id = (select auth.uid()));
create policy ledger_family on public.ledger_batches for select to authenticated using (
  household_id = (select m.household_id from public.household_members m where m.user_id = (select auth.uid()))
);

-- Internal replay. Retains full numeric precision until the UI formats amounts.
create function public.replay_ledger(family uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  b record;
  item jsonb;
  positions jsonb := '{}'::jsonb;
  cash jsonb := '{"me":0,"wife":0,"joint":0}'::jsonb;
  realized jsonb := cash;
  k text;
  p jsonb;
  kind text;
  movement numeric;
  qty integer;
  held bigint;
  cost numeric;
  gross numeric;
  fees numeric;
  released numeric;
begin
  for b in select owner, items from public.ledger_batches
    where household_id = family and voided_at is null order by trade_date, id
  loop
    for item in select value from jsonb_array_elements(b.items) loop
      kind := item->>'kind';
      movement := 0;
      if kind in ('deposit', 'withdraw', 'opening_cash') then
        movement := (item->>'amount')::numeric * case when kind = 'withdraw' then -1 else 1 end;
      else
        k := b.owner || ':' || (item->>'market') || ':' || (item->>'symbol');
        p := positions->k;
        held := coalesce((p->>'shares')::bigint, 0);
        cost := coalesce((p->>'cost')::numeric, 0);
        qty := (item->>'shares')::integer;
        gross := round(qty * (item->>'price')::numeric, 2);
        fees := coalesce((item->>'fee')::numeric, 0) + coalesce((item->>'tax')::numeric, 0);
        if kind = 'sell' then
          if qty > held then
            raise exception '持股不足：% %，可賣 % 股', b.owner, item->>'symbol', held;
          end if;
          released := case when qty = held then cost else round(cost * qty / held, 10) end;
          cost := cost - released;
          held := held - qty;
          movement := gross - fees;
          realized := jsonb_set(realized, array[b.owner], to_jsonb((realized->>b.owner)::numeric + movement - released));
        else
          cost := cost + gross + fees;
          held := held + qty;
          if kind = 'buy' then movement := -(gross + fees); end if;
        end if;
        positions := jsonb_set(positions, array[k], jsonb_build_object(
          'owner', b.owner, 'market', item->>'market', 'symbol', item->>'symbol',
          'shares', held, 'cost', cost
        ));
        if item->>'funding' = 'external' then movement := 0; end if;
      end if;
      cash := jsonb_set(cash, array[b.owner], to_jsonb((cash->>b.owner)::numeric + movement));
    end loop;
  end loop;
  return jsonb_build_object('cash', cash, 'realized', realized, 'positions', positions);
end;
$$;

create function public.ledger_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare family uuid;
begin
  select household_id into family from public.household_members where user_id = auth.uid();
  if family is null then raise exception '此帳號尚未加入家庭帳簿'; end if;
  return public.replay_ledger(family);
end;
$$;

create function public.save_batch(p_request uuid, p_owner text, p_date date, p_items jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  member public.household_members%rowtype;
  previous public.ledger_batches%rowtype;
  item jsonb;
  kind text;
  qty numeric;
  price numeric;
  fee numeric;
  tax numeric;
  amount numeric;
  new_id bigint;
begin
  select * into member from public.household_members where user_id = auth.uid();
  if not found then raise exception '此帳號尚未加入家庭帳簿'; end if;
  perform 1 from public.households where id = member.household_id for update;

  select * into previous from public.ledger_batches
    where household_id = member.household_id and request_id = p_request;
  if found then
    if previous.owner = p_owner and previous.trade_date = p_date and previous.items = p_items
      and previous.recorded_by = member.owner and previous.voided_at is null then return previous.id; end if;
    raise exception '送出識別碼已使用，請重新填寫';
  end if;
  if p_request is null or p_owner is null or p_owner not in ('me','wife','joint')
     or p_date is null or p_date < date '1900-01-01' or p_date > (now() at time zone 'Asia/Taipei')::date
     or jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text) > 40000 then
    raise exception '日期、資產歸屬或明細格式有誤';
  end if;
  if jsonb_array_length(p_items) not between 1 and 25 then raise exception '每次可儲存 1 至 25 筆'; end if;

  for item in select value from jsonb_array_elements(p_items) loop
    kind := item->>'kind';
    if jsonb_typeof(item) is distinct from 'object' or kind is null
      or kind not in ('deposit','withdraw','opening_cash','buy','sell','opening_stock')
      or length(coalesce(item->>'note','')) > 300 then raise exception '交易類型或備註有誤'; end if;
    if kind in ('deposit','withdraw','opening_cash') then
      amount := (item->>'amount')::numeric;
      if amount is null or amount not between 0.01 and 100000000000 or amount <> round(amount, 2) then
        raise exception '現金金額須為正數，最多兩位小數';
      end if;
    else
      qty := (item->>'shares')::numeric;
      price := (item->>'price')::numeric;
      fee := coalesce((item->>'fee')::numeric, 0);
      tax := coalesce((item->>'tax')::numeric, 0);
      if coalesce(item->>'market','') not in ('TWSE','TPEX') or coalesce(item->>'symbol','') !~ '^[0-9][0-9A-Z]{3,7}$'
        or qty is null or qty not between 1 and 100000000 or qty <> trunc(qty)
        or price is null or price not between (case when kind = 'opening_stock' then 0 else 0.0001 end) and 10000000
        or price <> round(price, 4)
        or fee not between 0 and 100000000 or fee <> round(fee, 2)
        or tax not between 0 and 100000000 or tax <> round(tax, 2)
        or (kind <> 'sell' and tax <> 0)
        or (kind = 'opening_stock' and fee <> 0)
        or (kind <> 'opening_stock' and coalesce(item->>'funding','') not in ('ledger','external'))
        or (kind = 'sell' and fee + tax > round(qty * price, 2))
        or (kind <> 'opening_stock' and round(qty * price, 2) = 0) then
        raise exception '請檢查股票代號、股數、單價及費用';
      end if;
    end if;
  end loop;
  insert into public.ledger_batches (household_id, request_id, recorded_by, owner, trade_date, items)
  values (member.household_id, p_request, member.owner, p_owner, p_date, p_items) returning id into new_id;
  perform public.replay_ledger(member.household_id);
  return new_id;
end;
$$;

create function public.void_batch(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare member public.household_members%rowtype;
begin
  select * into member from public.household_members where user_id = auth.uid();
  if not found then raise exception '此帳號尚未加入家庭帳簿'; end if;
  perform 1 from public.households where id = member.household_id for update;
  update public.ledger_batches set voided_at = now(), voided_by = member.owner
    where id = p_id and household_id = member.household_id and voided_at is null;
  if found then perform public.replay_ledger(member.household_id); end if;
end;
$$;

revoke all on function public.replay_ledger(uuid), public.ledger_summary(),
  public.save_batch(uuid,text,date,jsonb), public.void_batch(bigint) from public, anon, authenticated;
grant execute on function public.ledger_summary(), public.save_batch(uuid,text,date,jsonb), public.void_batch(bigint)
  to authenticated;
commit;
