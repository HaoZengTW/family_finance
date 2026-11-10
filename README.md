# 兩人的理財簿

兩個獨立的 Email／密碼帳號，共用一本家庭帳簿。前端是原生 HTML、CSS、JavaScript，部署到 Cloudflare Pages。Supabase 提供登入、Postgres 和報價 Edge Function。前端本身免安裝 npm 套件。

## 1｜建立 Supabase 專案與帳簿

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 建立一個新的 Project，等資料庫就緒。
2. 開啟 **SQL Editor → New query**，貼上 `supabase/schema.sql` 全文並執行一次。資料表、RLS、交易儲存和持倉計算會一起建立。此檔案用於新專案的初始建置。
3. 到 **Authentication** 的一般設定關閉 **Allow new users to sign up**，並確認 **Email** 登入已啟用。到 **Authentication → Users → Add user → Create new user**，建立你和太太的 Email／密碼帳號，各自選用密碼。若畫面有 **Auto Confirm User**，可以在你確認 Email 無誤後勾選。
4. 回到 **SQL Editor**，貼上 `supabase/setup-members.sql` 的內容，將兩個範例 Email 換成實際登入帳號，再執行一次。請只在 SQL Editor 填寫實際 Email。這一步把兩個 Auth 帳號連到同一本家庭帳簿。
5. 從專案的 **Connect** 或 **Settings → API Keys** 取得 Project URL 與 **Publishable key**，填入 `site/config.js`。Project URL 使用預設的 `https://<project-ref>.supabase.co` 網址。前端只需要可公開的 `sb_publishable_...` 金鑰。

[Supabase Auth 設定](https://supabase.com/docs/guides/auth/general-configuration) · [密碼登入](https://supabase.com/docs/guides/auth/passwords) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 2｜部署報價 Edge Function

用終端機進入本專案根目錄。安裝 Node.js 20 或更新版本後執行：

```sh
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy quotes --no-verify-jwt --use-api
```

`YOUR_PROJECT_REF` 是 Supabase 預設網域的子網域。若已經執行過 `supabase init`，從登入或連結步驟繼續即可。SQL 已在 Dashboard 執行，因此此處只部署 Function。

此部署由 Function 自己向 Supabase Auth 驗證使用者，再以該使用者的 token 呼叫帳簿 RPC，確認家庭成員資格後才查行情。`--no-verify-jwt` 關閉的是閘道的 JWT 檢查。部署後可用未登入請求驗證 Function 回傳 HTTP 401：

```sh
curl -i -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/quotes'
```

預設使用證交所與櫃買中心的收盤資料，免行情金鑰。如果富果確認你的方案可以在夫妻私人帳簿使用，進入 **Edge Functions → Secrets** 新增 `FUGLE_API_KEY`。有金鑰時，台灣時間平日 09:00–13:30 會在更新 Dashboard 時優先查當日的最近成交。只查持有標的，每次最多試查 20 檔，其餘用收盤資料。遇到假日、限流或資料不足也會改用收盤資料。Function 只在伺服器端讀取富果金鑰。

[Edge Function 部署](https://supabase.com/docs/guides/functions/deploy) · [Secrets](https://supabase.com/docs/guides/functions/secrets) · [富果方案](https://developer.fugle.tw/docs/pricing/) · [富果使用規範](https://developer.fugle.tw/docs/data/intro/)

## 3｜部署 Cloudflare Pages

1. 在 GitHub 建立一個空白 repository。把解壓後的專案內容放在 repo 根目錄，使 `site/`、`supabase/`、`README.md` 位於同一層。用 Git 推送到 `main`。範例指令如下，請將 URL 換成你的 repository：

   ```sh
   git init -b main
   git add .
   git commit -m "Initial family finance app"
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPO.git
   git push -u origin main
   ```

2. 在 Cloudflare Dashboard 開啟 **Workers & Pages**，建立 **Pages** 專案，選擇 **Connect to Git** 或 **Import an existing Git repository**，授權並選擇剛建立的 repo。
3. 依下表設定並部署。Cloudflare 只會發佈 `site/`。

   | 欄位 | 值 |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | 留空 |
   | Build output directory | `site` |
   | Root directory | 留空 |

4. 開啟部署完成的 `https://<project>.pages.dev`。在 Supabase 的 **Authentication → URL Configuration** 將 **Site URL** 設成這個正式網址。開啟頁面後，用兩個帳號分別驗收。

[Cloudflare Git 整合](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Cloudflare 建置設定](https://developers.cloudflare.com/pages/configuration/build-configuration/)

## 4｜部署後驗收

1. 用你的帳號登入，歸屬選「老婆」。同批新增「期初現金 50,000 元」及「上市 2330、買進 100 股、每股 50 元、手續費 20 元、帳內交割」。
2. 開啟持有總覽，選「老婆」。應有現金 **44,980 元**、持股 **100 股**、每股成本 **50.2 元**。市值依行情變動。交易歷史應顯示「我登錄」。
3. 以太太的帳號登入，確認看得到同一筆交易。用無痕視窗打開網站，確認頁面要求登入。
4. 在測試資料上嘗試賣出 101 股，應提示持股不足。驗收結束後，可在交易歷史將測試批次作廢。

## 第一版帳務規則

- 各歸屬只有一個台幣現金餘額。帳內交割直接計入該餘額。外部資金只更新股票持倉及損益。
- 交割現金以登錄的交易日期入帳。若要和銀行實際扣款日期完全一致，需要另外增加交割日欄位。現金可為負，畫面會在所選範圍的合計餘額為負時提醒核對。
- 期初現金是增加額，請按歸屬只匯入一次。期初持股請填每股成本，日期放在要納入計算的買賣之前。同一天依儲存順序、同批依明細順序計算。
- 股票成本按歸屬、市場和代號分開，以移動加權平均計算。手續費與賣出稅費採人工填寫。交易打錯可先作廢再重登，作廢若會導致後續賣超，須先處理相關賣出。
- 使用一般盤報價估值。拆股、股票／現金股利、跨帳簿移轉與外幣目前未納入自動計算。報價缺漏時標示估值不完整。
- Supabase 免費專案在使用量過低時可能暫停，可在 Dashboard 恢復專案。[Supabase 專案暫停](https://supabase.com/docs/guides/platform/free-project-pausing)
