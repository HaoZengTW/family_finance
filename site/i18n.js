// 多語系：繁體中文（zh-TW）、英文（en）、越南文（vi）
const storageKey = 'family-lang';

export const languages = { 'zh-TW': '繁體中文', en: 'English', vi: 'Tiếng Việt' };

const dict = {
  'zh-TW': {
    title: '兩人的理財簿', language: '語言', logout: '登出',
    loginEyebrow: '我們的家庭帳簿', loginTitle: '一起記帳，一起掌握資產。', loginIntro: '用你自己的帳號登入，記錄現金與投資。',
    email: '電子郵件', password: '密碼', login: '登入', clearSession: '清除登入狀態',
    nav: '主要頁面', tabLedger: '交易紀錄', tabDashboard: '持有總覽',
    ledgerEyebrow: '01 / 交易紀錄', ledgerTitle: '登錄交易', ledgerIntro: '選好日期與歸屬後，可一次記錄多筆明細。',
    tradeDate: '交易日期', owner: '資產歸屬', addItem: '＋ 新增明細', save: '儲存交易',
    historyTitle: '交易歷史', reload: '重新整理', prev: '上一頁', next: '下一頁', page: '第 {n} 頁',
    dashEyebrow: '02 / 持有總覽', dashTitle: '目前持有資產', dashIntro: '從現金餘額、持股與參考行情查看你們的資產。',
    all: '全家', refresh: '更新帳簿與行情', holdingsTitle: '持股明細',
    thStock: '股票', thOwner: '歸屬', thShares: '股數', thCost: '每股成本', thTotalCost: '總成本', thPrice: '參考價',
    thValue: '估計市值', thProfit: '未實現損益', thSource: '行情來源與時間',
    footer: '台幣帳簿 · 台灣時間',
    kind: '交易類型', remove: '移除此明細', amount: '金額（TWD）', market: '市場', twse: '上市 TWSE', tpex: '上櫃 TPEx',
    symbol: '股票代號', symbolHint: '如 2330、0050', unit: '輸入單位', unitShare: '零股／按股輸入', unitLot: '整股／按張輸入',
    shares: '股數', lots: '張數', lotSize: '每張股數', price: '每股成交價', openingPrice: '期初每股成本',
    fee: '手續費', tax: '交易稅', funding: '交割現金', fundingLedger: '同歸屬的帳內現金', fundingExternal: '外部資金',
    note: '備註', optional: '選填', item: '明細 {n}',
    deposit: '現金存入', withdraw: '現金提領', buy: '股票買進', sell: '股票賣出', opening_cash: '期初現金', opening_stock: '期初持股',
    me: '曾顥', wife: '老婆', joint: '共同',
    sessionExpired: '登入已過期，請重新登入。', serviceDown: '服務暫時無法使用', signingIn: '登入中…',
    loginFailed: '登入失敗，請確認 Email、密碼和帳號狀態。', logoutUnconfirmed: '已清除這個分頁的登入狀態，伺服器登出未確認。',
    identity: '登入身分 · {name}', maxShares: '換算後最多可輸入 100,000,000 股',
    previewOpening: '{shares} 股 · 期初成本 {gross}', previewTrade: '{shares} 股 · 成交 {gross} · {funding} {net}',
    settleExternal: '外部交割', settleLedger: '帳內交割',
    saving: '儲存中…', saved: '已儲存交易 #{id}', saveUnconfirmed: '儲存結果未確認。保留明細並再按一次儲存，或先查交易歷史。',
    descStock: '{market} {symbol} · {shares} 股 × {price} 元', descFee: '手續費 {v}', descTax: '交易稅 {v}',
    loading: '載入中…', emptyPage: '這一頁沒有交易。',
    historyHead: '{date} · {owner} · {by}登錄', voidedBy: '已由{by}作廢', void: '作廢',
    confirmVoid: '作廢這批交易後，現金與持股會重新計算。確定作廢？',
    intraday: '富果盤中 · {time}', closeTWSE: '證交所收盤 · {date}', closeTPEX: '櫃買中心收盤 · {date}',
    noDate: '日期未提供', noQuote: '報價暫缺',
    mCash: '現金餘額', mCost: '持股總成本', mValue: '股票估計市值', mTotal: '現金＋股票', mUnrealized: '未實現損益', mRealized: '已實現損益',
    partial: '{v}（部分）', incomplete: '估值不完整',
    noHoldings: '目前沒有持股。', missingQuotes: '{n} 檔持倉缺少報價，已排除在估值之外。', negativeCash: '帳內現金為負，請核對期初金額與交割來源。',
    updating: '更新中…', updateFailed: '更新失敗。',
    notConfigured: '請先依部署指南填寫 Supabase Project URL 和 Publishable Key。', checkingSession: '確認登入狀態…',
    // 後端錯誤訊息
    errLogin: '請先登入', errSessionChanged: '登入已變更', errNotMember: '此帳號尚未加入家庭帳簿', errSessionInvalid: '登入已失效',
    errLedger: '無法讀取家庭帳簿', errQuotes: '行情服務暫時無法查詢', errRequestUsed: '送出識別碼已使用，請重新填寫',
    errFormat: '日期、資產歸屬或明細格式有誤', errItemCount: '每次可儲存 1 至 25 筆', errKindNote: '交易類型或備註有誤',
    errCash: '現金金額須為正數，最多兩位小數', errStock: '請檢查股票代號、股數、單價及費用',
    errShares: '持股不足：{owner} {symbol}，可賣 {held} 股',
  },
  en: {
    title: 'Our Finance Book', language: 'Language', logout: 'Log out',
    loginEyebrow: 'Our family ledger', loginTitle: 'Track our money and assets together.', loginIntro: 'Sign in with your own account to record cash and investments.',
    email: 'Email', password: 'Password', login: 'Sign in', clearSession: 'Clear sign-in',
    nav: 'Main pages', tabLedger: 'Transactions', tabDashboard: 'Holdings',
    ledgerEyebrow: '01 / TRANSACTIONS', ledgerTitle: 'Record transactions', ledgerIntro: 'Choose a date and owner, then record several items at once.',
    tradeDate: 'Trade date', owner: 'Owner', addItem: '+ Add item', save: 'Save transactions',
    historyTitle: 'History', reload: 'Reload', prev: 'Previous', next: 'Next', page: 'Page {n}',
    dashEyebrow: '02 / HOLDINGS', dashTitle: 'Current holdings', dashIntro: 'Review your cash balance, stocks and reference prices.',
    all: 'Whole family', refresh: 'Refresh ledger & quotes', holdingsTitle: 'Stock holdings',
    thStock: 'Stock', thOwner: 'Owner', thShares: 'Shares', thCost: 'Cost / share', thTotalCost: 'Total cost', thPrice: 'Ref. price',
    thValue: 'Est. value', thProfit: 'Unrealized P/L', thSource: 'Quote source & time',
    footer: 'TWD ledger · Taiwan time',
    kind: 'Type', remove: 'Remove item', amount: 'Amount (TWD)', market: 'Market', twse: 'Listed (TWSE)', tpex: 'OTC (TPEx)',
    symbol: 'Symbol', symbolHint: 'e.g. 2330, 0050', unit: 'Unit', unitShare: 'By share (odd lot)', unitLot: 'By lot (board lot)',
    shares: 'Shares', lots: 'Lots', lotSize: 'Shares per lot', price: 'Price per share', openingPrice: 'Opening cost per share',
    fee: 'Fee', tax: 'Transaction tax', funding: 'Settlement cash', fundingLedger: "Same owner's ledger cash", fundingExternal: 'External funds',
    note: 'Note', optional: 'Optional', item: 'Item {n}',
    deposit: 'Cash deposit', withdraw: 'Cash withdrawal', buy: 'Buy stock', sell: 'Sell stock', opening_cash: 'Opening cash', opening_stock: 'Opening stock',
    me: '曾顥', wife: 'Amy Thong', joint: 'Joint',
    sessionExpired: 'Your session has expired. Please sign in again.', serviceDown: 'Service temporarily unavailable', signingIn: 'Signing in…',
    loginFailed: 'Sign-in failed. Please check your email, password and account status.', logoutUnconfirmed: 'Signed out in this tab; server sign-out not confirmed.',
    identity: 'Signed in as {name}', maxShares: 'At most 100,000,000 shares after conversion',
    previewOpening: '{shares} shares · opening cost {gross}', previewTrade: '{shares} shares · trade {gross} · {funding} {net}',
    settleExternal: 'external settlement', settleLedger: 'ledger settlement',
    saving: 'Saving…', saved: 'Saved transaction #{id}', saveUnconfirmed: 'Save not confirmed. Keep these items and press Save again, or check the history first.',
    descStock: '{market} {symbol} · {shares} shares × NT${price}', descFee: 'fee {v}', descTax: 'tax {v}',
    loading: 'Loading…', emptyPage: 'No transactions on this page.',
    historyHead: '{date} · {owner} · recorded by {by}', voidedBy: 'voided by {by}', void: 'Void',
    confirmVoid: 'Voiding this batch will recalculate cash and holdings. Void it?',
    intraday: 'Fugle intraday · {time}', closeTWSE: 'TWSE close · {date}', closeTPEX: 'TPEx close · {date}',
    noDate: 'date not provided', noQuote: 'No quote',
    mCash: 'Cash balance', mCost: 'Total cost', mValue: 'Est. stock value', mTotal: 'Cash + stocks', mUnrealized: 'Unrealized P/L', mRealized: 'Realized P/L',
    partial: '{v} (partial)', incomplete: 'Incomplete valuation',
    noHoldings: 'No stock holdings.', missingQuotes: '{n} holding(s) have no quote and are excluded from the valuation.', negativeCash: 'Ledger cash is negative. Please check opening balances and settlement sources.',
    updating: 'Updating…', updateFailed: 'Update failed. ',
    notConfigured: 'Please fill in the Supabase Project URL and Publishable Key as described in the deployment guide.', checkingSession: 'Checking sign-in…',
    errLogin: 'Please sign in first', errSessionChanged: 'Sign-in changed', errNotMember: 'This account has not joined the family ledger', errSessionInvalid: 'Sign-in is no longer valid',
    errLedger: 'Unable to read the family ledger', errQuotes: 'Quote service temporarily unavailable', errRequestUsed: 'This submission ID was already used. Please fill in the form again.',
    errFormat: 'Invalid date, owner or item format', errItemCount: 'You can save 1 to 25 items at a time', errKindNote: 'Invalid transaction type or note',
    errCash: 'Cash amount must be positive, with at most two decimals', errStock: 'Please check the symbol, shares, price and fees',
    errShares: 'Not enough shares: {owner} {symbol}, {held} shares available to sell',
  },
  vi: {
    title: 'Sổ tài chính của hai ta', language: 'Ngôn ngữ', logout: 'Đăng xuất',
    loginEyebrow: 'Sổ sách gia đình chúng ta', loginTitle: 'Cùng ghi chép, cùng nắm rõ tài sản.', loginIntro: 'Đăng nhập bằng tài khoản của bạn để ghi lại tiền mặt và đầu tư.',
    email: 'Email', password: 'Mật khẩu', login: 'Đăng nhập', clearSession: 'Xóa trạng thái đăng nhập',
    nav: 'Trang chính', tabLedger: 'Giao dịch', tabDashboard: 'Tài sản',
    ledgerEyebrow: '01 / GIAO DỊCH', ledgerTitle: 'Ghi giao dịch', ledgerIntro: 'Chọn ngày và chủ sở hữu, sau đó có thể ghi nhiều mục cùng lúc.',
    tradeDate: 'Ngày giao dịch', owner: 'Chủ sở hữu', addItem: '+ Thêm mục', save: 'Lưu giao dịch',
    historyTitle: 'Lịch sử giao dịch', reload: 'Tải lại', prev: 'Trang trước', next: 'Trang sau', page: 'Trang {n}',
    dashEyebrow: '02 / TÀI SẢN', dashTitle: 'Tài sản hiện có', dashIntro: 'Xem số dư tiền mặt, cổ phiếu và giá tham khảo.',
    all: 'Cả nhà', refresh: 'Cập nhật sổ và giá', holdingsTitle: 'Chi tiết cổ phiếu',
    thStock: 'Cổ phiếu', thOwner: 'Chủ sở hữu', thShares: 'Số cổ phiếu', thCost: 'Giá vốn / cp', thTotalCost: 'Tổng giá vốn', thPrice: 'Giá tham khảo',
    thValue: 'Giá trị ước tính', thProfit: 'Lãi/lỗ chưa thực hiện', thSource: 'Nguồn & thời gian giá',
    footer: 'Sổ TWD · Giờ Đài Loan',
    kind: 'Loại giao dịch', remove: 'Xóa mục này', amount: 'Số tiền (TWD)', market: 'Thị trường', twse: 'Niêm yết (TWSE)', tpex: 'OTC (TPEx)',
    symbol: 'Mã cổ phiếu', symbolHint: 'VD: 2330, 0050', unit: 'Đơn vị nhập', unitShare: 'Theo cổ phiếu (lô lẻ)', unitLot: 'Theo lô (lô chẵn)',
    shares: 'Số cổ phiếu', lots: 'Số lô', lotSize: 'Số cổ phiếu mỗi lô', price: 'Giá khớp mỗi cổ phiếu', openingPrice: 'Giá vốn đầu kỳ mỗi cổ phiếu',
    fee: 'Phí giao dịch', tax: 'Thuế giao dịch', funding: 'Tiền thanh toán', fundingLedger: 'Tiền mặt trong sổ của cùng chủ sở hữu', fundingExternal: 'Tiền bên ngoài',
    note: 'Ghi chú', optional: 'Không bắt buộc', item: 'Mục {n}',
    deposit: 'Nạp tiền mặt', withdraw: 'Rút tiền mặt', buy: 'Mua cổ phiếu', sell: 'Bán cổ phiếu', opening_cash: 'Tiền mặt đầu kỳ', opening_stock: 'Cổ phiếu đầu kỳ',
    me: '曾顥', wife: 'Amy Thong', joint: 'Chung',
    sessionExpired: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', serviceDown: 'Dịch vụ tạm thời không khả dụng', signingIn: 'Đang đăng nhập…',
    loginFailed: 'Đăng nhập thất bại, vui lòng kiểm tra email, mật khẩu và trạng thái tài khoản.', logoutUnconfirmed: 'Đã xóa đăng nhập ở tab này; chưa xác nhận đăng xuất trên máy chủ.',
    identity: 'Đăng nhập: {name}', maxShares: 'Tối đa 100.000.000 cổ phiếu sau khi quy đổi',
    previewOpening: '{shares} cổ phiếu · giá vốn đầu kỳ {gross}', previewTrade: '{shares} cổ phiếu · khớp {gross} · {funding} {net}',
    settleExternal: 'thanh toán ngoài', settleLedger: 'thanh toán trong sổ',
    saving: 'Đang lưu…', saved: 'Đã lưu giao dịch #{id}', saveUnconfirmed: 'Chưa xác nhận lưu. Giữ nguyên các mục và bấm Lưu lại, hoặc kiểm tra lịch sử trước.',
    descStock: '{market} {symbol} · {shares} cổ phiếu × {price} TWD', descFee: 'phí {v}', descTax: 'thuế {v}',
    loading: 'Đang tải…', emptyPage: 'Trang này không có giao dịch.',
    historyHead: '{date} · {owner} · {by} ghi', voidedBy: 'đã bị {by} hủy', void: 'Hủy',
    confirmVoid: 'Sau khi hủy lô giao dịch này, tiền mặt và cổ phiếu sẽ được tính lại. Bạn chắc chắn muốn hủy?',
    intraday: 'Fugle trong phiên · {time}', closeTWSE: 'Giá đóng cửa TWSE · {date}', closeTPEX: 'Giá đóng cửa TPEx · {date}',
    noDate: 'không có ngày', noQuote: 'Chưa có giá',
    mCash: 'Số dư tiền mặt', mCost: 'Tổng giá vốn', mValue: 'Giá trị cổ phiếu ước tính', mTotal: 'Tiền mặt + cổ phiếu', mUnrealized: 'Lãi/lỗ chưa thực hiện', mRealized: 'Lãi/lỗ đã thực hiện',
    partial: '{v} (một phần)', incomplete: 'Định giá chưa đầy đủ',
    noHoldings: 'Hiện không có cổ phiếu.', missingQuotes: '{n} mã chưa có giá, không được tính vào định giá.', negativeCash: 'Tiền mặt trong sổ đang âm, vui lòng kiểm tra số dư đầu kỳ và nguồn thanh toán.',
    updating: 'Đang cập nhật…', updateFailed: 'Cập nhật thất bại. ',
    notConfigured: 'Vui lòng điền Supabase Project URL và Publishable Key theo hướng dẫn triển khai.', checkingSession: 'Đang kiểm tra đăng nhập…',
    errLogin: 'Vui lòng đăng nhập trước', errSessionChanged: 'Thông tin đăng nhập đã thay đổi', errNotMember: 'Tài khoản này chưa tham gia sổ gia đình', errSessionInvalid: 'Phiên đăng nhập không còn hiệu lực',
    errLedger: 'Không thể đọc sổ gia đình', errQuotes: 'Dịch vụ báo giá tạm thời không khả dụng', errRequestUsed: 'Mã gửi này đã được dùng, vui lòng nhập lại.',
    errFormat: 'Ngày, chủ sở hữu hoặc định dạng mục không hợp lệ', errItemCount: 'Mỗi lần có thể lưu từ 1 đến 25 mục', errKindNote: 'Loại giao dịch hoặc ghi chú không hợp lệ',
    errCash: 'Số tiền phải là số dương, tối đa hai chữ số thập phân', errStock: 'Vui lòng kiểm tra mã cổ phiếu, số lượng, giá và phí',
    errShares: 'Không đủ cổ phiếu: {owner} {symbol}, có thể bán {held} cổ phiếu',
  },
};

function detect() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (dict[saved]) return saved;
  } catch { /* 無法使用 localStorage 時改用瀏覽器語言 */ }
  for (const code of navigator.languages ?? [navigator.language]) {
    const lower = String(code).toLowerCase();
    if (lower.startsWith('vi')) return 'vi';
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('zh')) return 'zh-TW';
  }
  return 'zh-TW';
}

export let lang = detect();

export function setLang(code) {
  if (!dict[code]) return;
  lang = code;
  try { localStorage.setItem(storageKey, code); } catch { /* 僅本次有效 */ }
  applyStatic();
}

export function t(key, params = {}) {
  const text = dict[lang][key] ?? dict['zh-TW'][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

// 套用 HTML 上的 data-i18n（文字）、data-i18n-placeholder、data-i18n-aria
export function applyStatic(root = document) {
  document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : lang;
  document.title = t('title');
  const scopes = [root, ...[...root.querySelectorAll('template')].map(tpl => tpl.content)];
  for (const scope of scopes) {
    for (const node of scope.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const node of scope.querySelectorAll('[data-i18n-placeholder]')) node.placeholder = t(node.dataset.i18nPlaceholder);
    for (const node of scope.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
}

// 後端回傳的中文錯誤訊息對照
const serverErrors = {
  '服務暫時無法使用': 'serviceDown', '請先登入': 'errLogin', '登入已變更': 'errSessionChanged',
  '此帳號尚未加入家庭帳簿': 'errNotMember', '登入已失效': 'errSessionInvalid', '無法讀取家庭帳簿': 'errLedger',
  '行情服務暫時無法查詢': 'errQuotes', '送出識別碼已使用，請重新填寫': 'errRequestUsed',
  '日期、資產歸屬或明細格式有誤': 'errFormat', '每次可儲存 1 至 25 筆': 'errItemCount', '交易類型或備註有誤': 'errKindNote',
  '現金金額須為正數，最多兩位小數': 'errCash', '請檢查股票代號、股數、單價及費用': 'errStock',
};

export function translateError(message) {
  if (!message) return t('serviceDown');
  if (serverErrors[message]) return t(serverErrors[message]);
  const shares = /^持股不足：(\S+) (\S+)，可賣 (\S+) 股$/.exec(message);
  if (shares) return t('errShares', { owner: t(shares[1]), symbol: shares[2], held: shares[3] });
  return message;
}
