"use strict";

/* KZG Option House. Renders data/report.json. No network beyond that file. */

const WINDOWS = { "30D": 30, "90D": 90, "1Y": 252, ALL: Infinity };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ZH_WD = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const EN_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STR = {
  zh: {
    today: "回到最新", themeDark: "暗色", themeLight: "亮色", lang: "EN", notes: "指标说明",
    export: "导出 PNG", skip: "跳到主要内容", pageTitle: "KZG Option House · 美股期权日报",
    generated: "生成", close: "关闭", timeline: "交易日时间轴", to: "至", selected: "已选交易日",
    openCal: "打开日历", hasData: "有数据", noData: "无交易/未落地", tapeKicker: "交易日读盘总线",
    vsPrior: "较前日", leaders: "头部", overview: "昨日总览", flow: "期权资金流", history: "历史趋势",
    reportCanvas: "日报画布", reportHint: "网页可交互，PNG 只导出这张日报。",
    tapeSummary: "盘口摘要", tapeHint: "按当前交易日同步刷新。", filterNames: "筛选个股",
    indexTape: "三大指数期权数据", intraday: "全市场日内成交分布", etfTop: "ETF 期权成交量 Top",
    stockTop10: "个股 Top10", stockTop25: "个股 Top25", sortVol: "成交量", sortPrem: "权利金",
    sortCp: "CP", sortAvg: "单笔张数", direction: "方向", premiumFilter: "权利金",
    structureFilter: "结构", all: "全部", noFlow: "没有符合条件的流向。",
    historyTitle: "历史趋势与轮动", heatCount: "量价同升", coolCount: "同步降温",
    window: "窗口", todayBar: "当天", pathRot: "轮动位置", pathLens: "标的镜头", pathQueue: "动量队列",
    upQuad: "升温", downQuad: "降温", mixedQuad: "分化", na: "样本不足", chg20: "20日变化",
    catIndex: "指数", catEtf: "ETF", catStock: "个股", openLed: "开盘成交主导", closeLed: "尾盘成交主导",
    evenLed: "节奏均衡", hotVol: "放量", coldVol: "缩量", flatVol: "量能均衡",
    domIndex: "指数主导", domEtf: "ETF 主导", domStock: "个股主导",
    highBand: "高位", midBand: "中位", lowBand: "低位", vs20: "相对 20 日",
    unitWan: "单位 万张", pulseVol: "量能峰值", pulsePrem: "权利金峰值", pulseLatest: "最新",
    coverageSub: "合约记录", session: "交易日", emptyFilter: "没有匹配的标的。",
    views: "数据视图", flowHint: "方向 · 结构 · 权利金", histHint: "轮动与节奏",
    sheetCredit: "口罩哥独家数据整理 | KZG Option House",
  },
  en: {
    today: "Latest", themeDark: "Dark", themeLight: "Light", lang: "中文", notes: "Notes",
    export: "Export PNG", skip: "Skip to content", pageTitle: "KZG Option House · US Options Daily",
    generated: "Generated", close: "Close", timeline: "Trading-day timeline", to: "to", selected: "Selected",
    openCal: "Open calendar", hasData: "Has data", noData: "No session", tapeKicker: "Session tape",
    vsPrior: "vs prior", leaders: "Leaders", overview: "Session overview", flow: "Options flow",
    history: "History", reportCanvas: "Report canvas", reportHint: "The page is interactive. PNG export is this sheet only.",
    tapeSummary: "Tape summary", tapeHint: "Refreshes with the selected session.", filterNames: "Filter names",
    indexTape: "Index option tape", intraday: "Market intraday distribution", etfTop: "ETF volume leaders",
    stockTop10: "Single-name Top 10", stockTop25: "Single-name Top 25", sortVol: "Volume", sortPrem: "Premium",
    sortCp: "CP", sortAvg: "Contracts / trade", direction: "Direction", premiumFilter: "Premium",
    structureFilter: "Structure", all: "All", noFlow: "No flow cards match these filters.",
    historyTitle: "History and rotation", heatCount: "Heating", coolCount: "Cooling",
    window: "Window", todayBar: "Session", pathRot: "Rotation", pathLens: "Lens", pathQueue: "Queue",
    upQuad: "Heating", downQuad: "Cooling", mixedQuad: "Mixed", na: "Not enough history", chg20: "20D change",
    catIndex: "Index", catEtf: "ETF", catStock: "Single stocks", openLed: "Open-led", closeLed: "Close-led",
    evenLed: "Even tape", hotVol: "Heavy volume", coldVol: "Light volume", flatVol: "Balanced volume",
    domIndex: "Index-led", domEtf: "ETF-led", domStock: "Single-name-led",
    highBand: "High", midBand: "Mid", lowBand: "Low", vs20: "vs 20D",
    unitWan: "Unit: 10k contracts", pulseVol: "Volume peak", pulsePrem: "Premium peak", pulseLatest: "Latest",
    coverageSub: "Contract rows", session: "Session", emptyFilter: "No matching names.",
    views: "Views", flowHint: "Side · structure · premium", histHint: "Rotation and pace",
    sheetCredit: "口罩哥独家数据整理 | KZG Option House",
  },
};

function N(section, zhTitle, zhTip, zhBody, enTitle, enTip, enBody) {
  return {
    section,
    zh: { title: zhTitle, tip: zhTip, body: zhBody },
    en: { title: enTitle, tip: enTip, body: enBody },
  };
}

const NOTES = {
  tradeDate: N("metrics", "当前交易日", "这条日报对应的美股交易日，不是日历上的今天。", "这条日报对应的美股交易日，不是日历上的“今天”。周末和休市日没有条目。", "Trade date", "The US session this report covers, not calendar today.", "The US trading day this report describes, not “today” on the calendar. Weekends and holidays have no row."),
  totalVol: N("metrics", "总期权成交量", "当日全市场期权成交张数，页面用万张显示。", "当日全市场期权成交张数。美股 1 张期权通常对应 100 股正股。页面用“万张”显示。", "Total option volume", "Contracts traded across the whole market. Shown in units of 10,000.", "Contracts traded across the whole market that day. One US option contract usually covers 100 shares. The page shows the figure in units of 10,000."),
  premium: N("metrics", "权利金成交额", "权利金名义金额，大约是成交价 × 张数 × 100，不是正股成交额。", "成交合约的权利金名义金额，大约是成交价 × 张数 × 100。它不是正股成交额。", "Premium notional", "Notional premium, roughly price × contracts × 100. Not stock turnover.", "Notional premium of traded contracts, roughly price × contracts × 100. It is not stock turnover."),
  marketCp: N("metrics", "Call/Put 成交量比", "Call 张数 ÷ Put 张数。大于 1 表示 Call 更多，不是涨跌预测。", "Call 成交张数 ÷ Put 成交张数。大于 1 表示 Call 成交更多。买卖双方、备兑和套保都算在里面，所以它描述的是结构，不是方向预测。", "Call/Put volume ratio", "Call contracts ÷ put contracts. Above 1 means more calls, not a forecast.", "Call contracts ÷ put contracts. Above 1 means more calls traded. Buys, sells, covered calls, and hedges all count, so this describes structure, not a direction forecast."),
  index: N("metrics", "指数", "指数期权（SPY、QQQ、IWM）成交量占全市场的比例，小字是这一类自己的 CP。", "指数类期权（SPY、QQQ、IWM）成交量占全市场的比例，小字是这一类自己的 CP。", "Index", "Share of market volume in SPY, QQQ, and IWM. The small figure is that group's CP.", "Share of market volume in index options (SPY, QQQ, IWM). The small figure is that group's own CP."),
  etf: N("metrics", "ETF", "其余 ETF 期权的成交占比，小字是这一类自己的 CP。", "其余 ETF 期权的成交占比，小字是这一类自己的 CP。", "ETF", "Share of volume in the other ETF options, with that group's own CP.", "Share of volume in the other ETF options. The small figure is that group's own CP."),
  stock: N("metrics", "个股", "个股期权的成交占比，小字是这一类自己的 CP。", "个股期权的成交占比，小字是这一类自己的 CP。个股 CP 通常高于指数，因为个股里方向性交易更多。", "Single stocks", "Share of single-stock option volume, with that group's own CP.", "Share of volume in single-stock options. The small figure is that group's own CP. Stock CP is usually higher than index CP because more of the flow is directional."),
  coverage: N("metrics", "数据覆盖", "当日纳入统计的期权合约记录条数，不是标的个数。", "当日纳入统计的期权合约记录条数，不是标的个数。", "Coverage", "How many option contract rows were counted, not how many underlyings.", "Number of option contract records included that day, not the number of underlyings."),
  volTemp: N("tape", "量能温度", "当日总成交量相对过去 20 个交易日均量的变化。", "当日总成交量相对过去 20 个交易日均量的变化。正数表示比近 20 日更热。", "Volume temperature", "Today's volume versus the prior 20-session average.", "Today's total volume versus the average of the prior 20 sessions. Positive means hotter than that 20-day baseline."),
  channel: N("tape", "主导通道", "指数、ETF、个股三类里，成交量占比最高的一类。", "指数、ETF、个股三类里，成交量占比最高的一类。", "Leading channel", "Whichever of index, ETF, or single stocks has the highest volume share.", "Whichever of index, ETF, or single stocks has the highest volume share."),
  rhythm: N("tape", "日内节奏", "前两个 30 分钟桶占全日的比例，斜线后面是尾盘桶。", "前两个 30 分钟桶（开盘约 60 分钟）占全日成交的比例，斜线后面是尾盘桶的占比。开盘占比高，说明成交集中在开盘。", "Intraday rhythm", "Share of the day in the first two 30-minute buckets. After the slash: the close.", "Share of the day in the first two 30-minute buckets (about the first 60 minutes). The figure after the slash is the closing buckets. A high open share means volume clustered at the open."),
  high28: N("tape", "28D 高点", "最近 28 个交易日里，总成交量最大的那一天。", "最近 28 个交易日里，总成交量最大的那一天。", "28D high", "The busiest session by total volume inside the latest 28 trading days.", "The busiest session by total volume inside the latest 28 trading days."),
  premAnchor: N("tape", "权利金锚", "当日权利金名义金额最大的标的。", "当日权利金名义金额最大的标的。", "Premium anchor", "The underlying with the largest premium notional that day.", "The underlying with the largest premium notional that day."),
  cpExtreme: N("tape", "CP 极端", "当日 Call/Put 比最高的标的。数字大只说明 Call 张数多。", "当日 Call/Put 比最高的标的。数字很大只说明 Call 张数远多于 Put。", "CP extreme", "The name with the highest Call/Put ratio. A large number only means more calls.", "The underlying with the highest Call/Put ratio that day. A large number only means far more call contracts than puts."),
  histRank: N("tape", "历史席位 / 分位", "把当日这个数放回全部样本里排名。P89 大约高于 89% 的交易日。", "把当日这个数放回全部样本里排名。P89 表示大约高于 89% 的历史交易日。", "Historical rank", "Where today's number sits in the full sample. P89 is above about 89% of sessions.", "Where today's number sits in the full sample. P89 means it is above about 89% of past sessions."),
  ppc: N("tape", "单张权利金", "权利金总额 ÷ 成交张数，平均每张合约花了多少权利金。", "权利金总额 ÷ 成交张数，也就是平均每张合约花了多少权利金。越高，交易越集中在更贵的合约上。", "Premium per contract", "Total premium ÷ contracts. Higher means flow sat in more expensive contracts.", "Total premium ÷ contracts, the average premium paid per contract. Higher means flow sat in more expensive contracts."),
  volWan: N("sheet", "成交量(万张)", "该标的当天全部期权成交张数，除以 10,000。", "该标的当天所有期权合约加总的成交张数，除以 10,000。", "Volume (10k)", "All option contracts on that name, summed, divided by 10,000.", "All option contracts on that name, summed, divided by 10,000."),
  cpRatio: N("sheet", "CP比", "该标的 Call 张数 ÷ Put 张数。", "该标的 Call 张数 ÷ Put 张数。", "CP ratio", "That name's call contracts ÷ put contracts.", "That name's call contracts ÷ put contracts."),
  premCol: N("sheet", "权利金", "该标的期权权利金名义成交额。", "该标的期权权利金名义成交额。", "Premium", "That name's option premium notional.", "That name's option premium notional."),
  hottest: N("sheet", "最热合约", "当天成交张数最大的一张合约。0925.C.772 是 9 月 25 日 Call、行权价 772。", "当天成交张数最大的那一张合约。写法 0925.C.772 表示 9 月 25 日到期、Call、行权价 772；P 表示 Put。", "Hottest contract", "The single contract with the most volume. 0925.C.772 is a Sep 25 call struck at 772.", "The single contract with the most volume. 0925.C.772 means expiry Sep 25, call, strike 772. P means put."),
  avgSize: N("sheet", "单笔张数", "成交张数 ÷ 成交笔数。越大，平均每笔越大。", "成交张数 ÷ 成交笔数。越大，平均每笔越大，更接近大单或机构单。", "Contracts per trade", "Contracts ÷ trades. Larger means a bigger average print.", "Contracts ÷ trades. Larger means a bigger average print, closer to a block or institutional print."),
  trades: N("sheet", "笔数", "成交了多少笔，不是多少张。", "成交了多少笔，不是多少张。", "Trades", "How many trades, not how many contracts.", "How many trades, not how many contracts."),
  bullBear: N("flow", "Bull / Bear", "按当日活跃合约归纳的偏多条数和偏空条数，不是账户盈亏。", "按当日活跃合约归纳出的偏多条数和偏空条数，用来看结构，不是账户盈亏。", "Bull / Bear", "Bullish and bearish row counts inferred from the day's active contracts. Not P&L.", "Counts of bullish and bearish rows inferred from the day's active contracts. They describe structure, not account P&L."),
  structure: N("flow", "Sweep / Block / Split", "Sweep 扫价，Block 大额单笔，Split 拆单。由龙头生成，不是逐笔回放。", "成交方式标签。Sweep 是扫过多个价位的急单，Block 是大额单笔，Split 是拆成多笔的单。这里由当日龙头合约生成，用来展示结构，不是逐笔交易所回放。", "Sweep / Block / Split", "Sweep lifts several prices, Block is one large print, Split is a broken-up order. Built from leaders, not a tick replay.", "Print-style tags. Sweep is an urgent order that lifts several prices, Block is one large print, Split is an order broken into several prints. These cards are built from the day's leaders to show structure. They are not a tick-by-tick exchange replay."),
  windows: N("history", "30D / 90D / 1Y / ALL", "趋势图往回看的交易日窗口。1Y 约 252 个交易日。", "趋势图往回看的交易日窗口。1Y 按约 252 个交易日。", "30D / 90D / 1Y / ALL", "How many sessions the trend chart looks back. 1Y is about 252 trading days.", "How many sessions the trend chart looks back. 1Y is about 252 trading days."),
  windowPct: N("history", "区间分位", "当前成交量在所选窗口里的百分位。", "当前成交量在所选窗口里的百分位。", "Window percentile", "Where current volume sits inside the selected window.", "Where current volume sits inside the selected window."),
  tapeTemp: N("history", "盘面温度", "量能、权利金和开盘集中度合成的 0–100 冷热分数。", "把量能、权利金和开盘集中度合成的 0–100 冷热分数。越高表示这一天越“热”。", "Tape temperature", "A 0–100 heat score blending volume, premium, and open concentration.", "A 0–100 heat score blending volume, premium, and open concentration. Higher means a hotter session."),
  volPercentile: N("history", "量能分位", "当日总成交量在全部历史样本中的百分位。", "当日总成交量在全部历史样本中的百分位。", "Volume percentile", "Today's total volume as a percentile of the full history.", "Today's total volume as a percentile of the full history."),
  premDensity: N("history", "权利金密度", "权利金总额 ÷ 成交张数。", "同“单张权利金”，权利金总额 ÷ 成交张数。", "Premium density", "Total premium ÷ contracts. Same idea as premium per contract.", "Same as premium per contract: total premium ÷ contracts."),
  openConc: N("history", "开盘集中度", "09:30 和 10:00 两个桶的成交占全日的比例。", "09:30 和 10:00 两个桶的成交占全日的比例。", "Open concentration", "Share of the day in the 09:30 and 10:00 buckets.", "Share of the day in the 09:30 and 10:00 buckets."),
  closeConc: N("history", "尾盘集中度", "最后两个时间桶的成交占全日的比例。", "最后两个时间桶的成交占全日的比例。", "Close concentration", "Share of the day in the last two time buckets.", "Share of the day in the last two time buckets."),
  leadCat: N("history", "主导类别", "成交占比最高的资产类别。", "成交占比最高的资产类别。", "Leading category", "The asset group with the highest volume share.", "The asset group with the highest volume share."),
  cpStruct: N("history", "CP 结构", "全市场 CP，以及它在历史样本里的百分位。", "全市场 CP，以及它在历史样本里的百分位。", "CP structure", "Market-wide CP, and where it sits in the historical sample.", "Market-wide CP, and where it sits in the historical sample."),
  heatStrip: N("history", "交易日温度带", "每一格是一个交易日，颜色按成交量冷热。点一格切到那一天。", "每一格是一个交易日，颜色按成交量相对近期均值的冷热。点一格就切到那一天。", "Session heat strip", "Each cell is one trading day, colored by volume versus a recent average. Click to jump.", "Each cell is one trading day. Color is volume versus a recent average. Click a cell to jump to that day."),
  heatmap: N("history", "热力图", "一行一个标的，一列一个 30 分钟桶，颜色越深张数越多，单位万张。", "每一行是一个标的，每一列是一个 30 分钟桶，颜色越深表示这个桶的成交张数越多，单位是万张。", "Heatmap", "Each row is a name, each column a 30-minute bucket. Darker means more contracts. Unit is 10k.", "Each row is an underlying, each column a 30-minute bucket. Darker means more contracts in that bucket. Unit is 10,000 contracts."),
  ghostBar: N("history", "日内成交分布的浅色柱", "浅色柱是过去 20 日同一时间桶的平均，实心柱是当天。", "过去 20 个交易日、同一个时间桶的平均成交。实心柱是当天。实心高于浅色，表示这个时段比近 20 日更忙。", "Ghost bar", "The pale bar is the 20-day average for that clock bucket. The solid bar is today.", "Average volume in that same bucket over the prior 20 sessions. The solid bar is today. Solid above ghost means that slot was busier than the 20-day baseline."),
  rotX: N("history", "轮动横轴", "该标的当日成交量相对它自己过去 20 日均量的变化。", "该标的当日成交量相对它自己过去 20 日均量的变化。", "Rotation X", "That name's volume versus its own prior 20-day average.", "That name's volume versus its own prior 20-day average."),
  rotY: N("history", "轮动纵轴", "该标的当日权利金相对它自己过去 20 日均权利金的变化。", "该标的当日权利金相对它自己过去 20 日均权利金的变化。", "Rotation Y", "That name's premium versus its own prior 20-day average premium.", "That name's premium versus its own prior 20-day average premium."),
  heatQuad: N("history", "右上（升温）", "成交量和权利金一起高于 20 日均值。", "成交量和权利金一起高于 20 日均值。", "Upper right (heating)", "Volume and premium both above their 20-day averages.", "Volume and premium both above their 20-day averages."),
  coolQuad: N("history", "左下（降温）", "成交量和权利金一起低于 20 日均值。", "成交量和权利金一起低于 20 日均值。", "Lower left (cooling)", "Volume and premium both below their 20-day averages.", "Volume and premium both below their 20-day averages."),
  quadCounts: N("history", "量价同升 / 同步降温", "升温、降温两个象限里的标的个数。", "上面两个象限里的标的个数。", "Heating / cooling counts", "How many names sit in the heating and cooling quadrants.", "How many names sit in those two quadrants."),
  spark: N("history", "动量小图", "该标的最近若干交易日的期权成交量折线。", "该标的最近若干交易日的期权成交量折线，用来看热度是在抬升还是消退。", "Momentum spark", "That name's option volume over recent sessions.", "That name's option volume over recent sessions, so you can see whether heat is rising or fading."),
};

const NOTE_SECTIONS = [
  { id: "metrics", zh: "指标条", en: "Metric rail" },
  { id: "tape", zh: "读盘总线", en: "Session tape" },
  { id: "sheet", zh: "日报和个股表", en: "Report and stock table" },
  { id: "flow", zh: "资金流", en: "Options flow" },
  { id: "history", zh: "历史和图表", en: "History and charts" },
];

const DISCLAIMER = {
  zh: "成交量包含买入和卖出、开仓和对冲，CP 高于 1 只表示 Call 张数更多，不是涨跌预测。",
  en: "Volume includes buys and sells, opening trades and hedges. A CP above 1 only means more call contracts traded, not a forecast.",
};

const state = {
  lang: "zh",
  theme: "light",
  date: "",
  focus: "SPY",
  sort: "volume",
  query: "",
  window: "90D",
  flowDir: "all",
  flowPrem: "all",
  flowStruct: "all",
  calY: 2026,
  calM: 9,
};

let DATA = null;
let dateIndexMap = new Map();
let dateSet = new Set();
const histCache = new Map();

function t(key) {
  const pack = STR[state.lang] || STR.zh;
  return pack[key] || STR.zh[key] || key;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function term(id, label) {
  const note = NOTES[id][state.lang];
  const text = label == null ? note.title : label;
  return `<span class="term"><span class="term-label" data-note="${id}">${esc(text)}</span><button type="button" class="note-mark" data-note="${id}" data-note-jump="${id}" aria-label="${esc(note.title)}">?</button></span>`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatLong(iso) {
  const dt = parseISO(iso);
  const [y, m, d] = iso.split("-").map(Number);
  if (state.lang === "zh") return `${y}年${m}月${d}日 ${ZH_WD[dt.getUTCDay()]}`;
  return `${EN_WD[dt.getUTCDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

function formatWan(n) {
  return (n / 10000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "万";
}

function wan1(n) {
  return (n / 10000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatVol(n) {
  if (state.lang === "zh") return formatWan(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  return Math.round(n).toLocaleString("en-US");
}

function formatPremium(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return sign + "$" + (abs / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return sign + "$" + (abs / 1e3).toFixed(1) + "K";
  return sign + "$" + Math.round(abs).toLocaleString("en-US");
}

function signedPct(x) {
  if (x == null || Number.isNaN(x)) return "—";
  const cls = x > 0.0005 ? "up" : x < -0.0005 ? "down" : "";
  const text = (x > 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
  return `<span class="${cls}">${text}</span>`;
}

function hex(color) {
  const h = color.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function cpHeat(cp) {
  const ratio = Math.max(0, Math.min(1, (cp - 0.55) / 2.4));
  return mix("#d7e2ea", "#ead7c4", ratio);
}

function dateIndex(iso) {
  return dateIndexMap.get(iso);
}

function current() {
  return DATA.days[dateIndex(state.date)];
}

function leaderMap(day) {
  if (!day._map) {
    const map = new Map();
    ["index", "etf", "stock"].forEach((key) => {
      day.leaders[key].forEach((row) => map.set(row.symbol, row));
    });
    day._map = map;
  }
  return day._map;
}

function allLeaders(day) {
  return ["index", "etf", "stock"].flatMap((key) => day.leaders[key]);
}

function symbolHistory(symbol) {
  if (!histCache.has(symbol)) {
    histCache.set(symbol, DATA.days.map((day) => leaderMap(day).get(symbol) || null));
  }
  return histCache.get(symbol);
}

function priorMean(symbol, index, field, n = 20) {
  const slice = symbolHistory(symbol).slice(Math.max(0, index - n), index).filter(Boolean);
  if (slice.length < 5) return null;
  return slice.reduce((sum, row) => sum + row[field], 0) / slice.length;
}

function marketMean(index, field, n = 20) {
  const slice = DATA.days.slice(Math.max(0, index - n), index);
  if (!slice.length) return null;
  return slice.reduce((sum, day) => sum + day[field], 0) / slice.length;
}

function percentile(values, value) {
  if (values.length < 2) return 50;
  const below = values.reduce((sum, item) => sum + (item < value ? 1 : 0), 0);
  return (below / (values.length - 1)) * 100;
}

function rankHigh(values, value) {
  return values.reduce((sum, item) => sum + (item > value ? 1 : 0), 0) + 1;
}

function bandLabel(p) {
  if (p >= 60) return t("highBand");
  if (p <= 40) return t("lowBand");
  return t("midBand");
}

function openShare(day) {
  return (day.buckets[0].total + day.buckets[1].total) / day.totalVol;
}

function closeShare(day) {
  const n = day.buckets.length;
  return (day.buckets[n - 1].total + day.buckets[n - 2].total) / day.totalVol;
}

function dominant(day) {
  const entries = Object.entries(day.categories).sort((a, b) => b[1].volume - a[1].volume);
  return { key: entries[0][0], row: entries[0][1], share: entries[0][1].volume / day.totalVol };
}

function catName(key) {
  if (key === "INDEX") return t("catIndex");
  if (key === "ETF") return t("catEtf");
  return t("catStock");
}

function volVs20(index, day) {
  const mean = marketMean(index, "totalVol");
  return mean ? day.totalVol / mean - 1 : 0;
}

function headline(day, index) {
  const vs = volVs20(index, day);
  const heat = vs > 0.12 ? "hot" : vs < -0.12 ? "cold" : "flat";
  const dom = dominant(day).key;
  const open = openShare(day);
  const close = closeShare(day);
  const rhythm = open > close + 0.03 ? "open" : close > open + 0.03 ? "close" : "even";
  const heatWord = { hot: t("hotVol"), cold: t("coldVol"), flat: t("flatVol") }[heat];
  const domWord = { INDEX: t("domIndex"), ETF: t("domEtf"), STOCK: t("domStock") }[dom];
  const rhyWord = { open: t("openLed"), close: t("closeLed"), even: t("evenLed") }[rhythm];
  return state.lang === "zh" ? `${heatWord}，${domWord}，${rhyWord}。` : `${heatWord}, ${domWord}, ${rhyWord}.`;
}

function extremeSymbol(day, pred, better) {
  let best = null;
  allLeaders(day).forEach((row) => {
    if (!pred(row)) return;
    if (!best || better(row, best)) best = row;
  });
  return best;
}

function rotationPoints(day, index) {
  const points = [];
  allLeaders(day).forEach((row) => {
    const volMean = priorMean(row.symbol, index, "volume");
    const premMean = priorMean(row.symbol, index, "premium");
    if (!volMean || !premMean) return;
    points.push({
      symbol: row.symbol,
      x: (row.volume / volMean - 1) * 100,
      y: (row.premium / premMean - 1) * 100,
    });
  });
  return points;
}

function sparkSymbols(day) {
  return allLeaders(day).slice().sort((a, b) => b.volume - a.volume).slice(0, 8).map((row) => row.symbol);
}

function ghostBuckets(index) {
  const slice = DATA.days.slice(Math.max(0, index - 20), index);
  if (!slice.length) return DATA.meta.times.map(() => 0);
  return DATA.meta.times.map((_, i) => slice.reduce((sum, day) => sum + day.buckets[i].total, 0) / slice.length);
}

function zScores(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance) || 1;
  return values.map((v) => (v - mean) / sd);
}

function zColor(z) {
  const ratio = Math.max(-1, Math.min(1, z / 1.6));
  const paper = state.theme === "dark" ? "#2a241c" : "#f4efe4";
  const hot = state.theme === "dark" ? "#e07a4a" : "#9a3412";
  const cold = state.theme === "dark" ? "#7cafdf" : "#2f6190";
  return ratio >= 0 ? mix(paper, hot, ratio) : mix(paper, cold, -ratio);
}

function tapeTemperature(day) {
  const volP = percentile(DATA.days.map((d) => d.totalVol), day.totalVol);
  const premP = percentile(DATA.days.map((d) => d.totalPremium), day.totalPremium);
  const openP = Math.max(0, Math.min(100, (openShare(day) / 0.4) * 100));
  return Math.round(0.45 * volP + 0.35 * premP + 0.2 * openP);
}

function filteredStocks(day) {
  let rows = day.leaders.stock.slice();
  const query = state.query.trim().toUpperCase();
  if (query) rows = rows.filter((row) => row.symbol.includes(query));
  const key = { volume: "volume", premium: "premium", cp: "cp", avg: "avgSize" }[state.sort] || "volume";
  rows.sort((a, b) => b[key] - a[key] || a.symbol.localeCompare(b.symbol));
  if (!query) rows = rows.slice(0, 25);
  return rows;
}

function filteredFlows(day) {
  return day.flows.filter((card) => {
    if (state.flowDir !== "all" && card.side !== state.flowDir) return false;
    if (state.flowStruct !== "all" && card.structure !== state.flowStruct) return false;
    if (state.flowPrem === "1b" && card.premium < 1e9) return false;
    if (state.flowPrem === "100m" && card.premium < 1e8) return false;
    if (state.flowPrem === "10m" && card.premium < 1e7) return false;
    return true;
  });
}

function digestLines(day) {
  if (state.lang === "zh") return day.digest;
  const idx = day.categories.INDEX;
  const etf = day.categories.ETF;
  const stk = day.categories.STOCK;
  const total = day.totalVol;
  const indexes = day.leaders.index.slice(0, 3).map((row) => `${row.symbol} ${wan1(row.volume)} CP${row.cp.toFixed(2)}`).join(" · ");
  const etfs = day.leaders.etf.slice(0, 3).map((row) => `${row.symbol} ${wan1(row.volume)}`).join(" · ");
  const stocks = day.leaders.stock.slice(0, 5).map((row) => `${row.symbol} ${wan1(row.volume)} CP${row.cp.toFixed(2)}`).join(" · ");
  const pool = day.leaders.stock.filter((row) => row.volume >= 200000);
  const extreme = pool.reduce((best, row) => (row.cp > best.cp ? row : best), pool[0]);
  return [
    `Session ${day.date}`,
    `Market ${formatVol(day.totalVol)} · ${formatVol(day.totalTxn)} trades · CP ${day.marketCp.toFixed(2)}`,
    `Index ${(100 * idx.volume / total).toFixed(1)}% CP ${idx.cp.toFixed(2)} | ETF ${(100 * etf.volume / total).toFixed(1)}% CP ${etf.cp.toFixed(2)} | Stocks ${(100 * stk.volume / total).toFixed(1)}% CP ${stk.cp.toFixed(2)}`,
    `Indexes: ${indexes}`,
    `ETF leaders: ${etfs}`,
    `Stock leaders: ${stocks}`,
    `Call extreme: ${extreme.symbol} CP ${extreme.cp.toFixed(2)} (${wan1(extreme.volume)})`,
  ];
}

function sheetTitle(day) {
  const [y, m, d] = day.date.split("-").map(Number);
  if (state.lang === "zh") return `${y}年${m}月${d}日 美股期权分钟数据`;
  return `US option minute tape · ${MONTHS[m - 1]} ${d}, ${y}`;
}

function paintChrome() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.documentElement.setAttribute("data-lang", state.lang);
  document.title = t("pageTitle");
  document.querySelectorAll("[data-chrome]").forEach((el) => {
    const key = el.dataset.chrome;
    if (key === "theme") el.textContent = state.theme === "dark" ? t("themeLight") : t("themeDark");
    else el.textContent = t(key);
  });
  const gen = document.getElementById("generatedAt");
  if (gen && DATA) gen.textContent = `${t("generated")} ${DATA.meta.generatedAt}`;
  const header = document.getElementById("headerDate");
  if (header && state.date) header.textContent = formatLong(state.date);
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", state.theme);
  if (state.theme === "dark") document.documentElement.setAttribute("dark", "");
  else document.documentElement.removeAttribute("dark");
  localStorage.setItem("kzg-theme", state.theme);
  paintChrome();
}

function setLang(lang) {
  state.lang = lang === "en" ? "en" : "zh";
  localStorage.setItem("kzg-lang", state.lang);
  paintChrome();
  if (!DATA) return;
  renderTimeline();
  renderRest();
  if (document.getElementById("notesDialog").open) renderNotes();
  if (!document.getElementById("calModal").hidden) renderCalendar();
}

function metricsHtml(day, index) {
  const prev = index > 0 ? DATA.days[index - 1] : null;
  const dod = prev ? day.totalVol / prev.totalVol - 1 : null;
  const idx = day.categories.INDEX;
  const etf = day.categories.ETF;
  const stk = day.categories.STOCK;
  const share = (part) => (100 * part / day.totalVol).toFixed(1) + "%";
  const cells = [
    [term("tradeDate"), `<strong id="tradeDate">${day.date}</strong>`, `<em>${t("session")}</em>`],
    [term("totalVol"), `<strong id="totalVol">${formatVol(day.totalVol)}</strong>`, `<em>${t("vsPrior")} ${signedPct(dod)}</em>`],
    [term("premium"), `<strong>${formatPremium(day.totalPremium)}</strong>`, "<em>premium notional</em>"],
    [term("marketCp"), `<strong>${day.marketCp.toFixed(2)}</strong>`, `<em>C ${day.totalCall.toLocaleString("en-US")}<br>P ${day.totalPut.toLocaleString("en-US")}</em>`],
    [term("index"), `<strong>${share(idx.volume)}</strong>`, `<em>CP ${idx.cp.toFixed(2)} · ${formatPremium(idx.premium)}</em>`],
    [term("etf"), `<strong>${share(etf.volume)}</strong>`, `<em>CP ${etf.cp.toFixed(2)} · ${formatPremium(etf.premium)}</em>`],
    [term("stock"), `<strong>${share(stk.volume)}</strong>`, `<em>CP ${stk.cp.toFixed(2)} · ${formatPremium(stk.premium)}</em>`],
    [term("coverage"), `<strong id="rowCount">${(day.rowCount || day.totalTxn).toLocaleString("en-US")}</strong>`, `<em>${formatVol(day.totalTxn)}${state.lang === "zh" ? "笔" : " trades"}</em>`],
  ];
  return `<section class="metric-rail" id="metricRail">${cells.map((cell) => `<article class="metric">${cell.join("")}</article>`).join("")}</section>`;
}

function tapeHtml(day, index) {
  const vs = volVs20(index, day);
  const prev = index > 0 ? DATA.days[index - 1] : null;
  const dod = prev ? day.totalVol / prev.totalVol - 1 : null;
  const dom = dominant(day);
  const open = openShare(day);
  const close = closeShare(day);
  const rhythm = open > close + 0.03 ? t("openLed") : close > open + 0.03 ? t("closeLed") : t("evenLed");
  let hi = index;
  for (let i = Math.max(0, index - 27); i <= index; i += 1) {
    if (DATA.days[i].totalVol > DATA.days[hi].totalVol) hi = i;
  }
  const anchor = extremeSymbol(day, () => true, (row, best) => row.premium > best.premium);
  const extreme = extremeSymbol(day, (row) => row.volume >= 200000, (row, best) => row.cp > best.cp);
  const heads = ["index", "etf", "stock"].map((key) => day.leaders[key][0].symbol).join(" / ");
  const vols = DATA.days.map((d) => d.totalVol);
  const prems = DATA.days.map((d) => d.totalPremium);
  const ppcs = DATA.days.map((d) => d.totalPremium / d.totalVol);
  const cps = DATA.days.map((d) => d.marketCp);
  const weights = DATA.days.map((d) => d.categories.STOCK.volume / d.totalVol);
  const ppc = day.totalPremium / day.totalVol;
  const ranks = [
    ["histRank", t("sortVol"), day.totalVol, vols],
    ["histRank", t("sortPrem"), day.totalPremium, prems],
    ["ppc", t("sortPrem") === "权利金" ? "单张权利金" : "Premium / contract", ppc, ppcs],
    ["histRank", "CP", day.marketCp, cps],
    ["histRank", state.lang === "zh" ? "个股份额" : "Stock weight", stkWeight(day), weights],
  ];
  const chips = [
    [term("volTemp"), signedPct(vs), t("vs20")],
    [term("channel"), catName(dom.key), `${(dom.share * 100).toFixed(1)}% · CP ${dom.row.cp.toFixed(2)}`],
    [term("rhythm"), rhythm, `${(open * 100).toFixed(1)}% / ${(close * 100).toFixed(1)}%`],
    [term("high28"), DATA.days[hi].date.slice(5).replace("-", "/"), formatVol(DATA.days[hi].totalVol)],
    [term("premAnchor"), anchor.symbol, formatPremium(anchor.premium)],
    [term("cpExtreme"), extreme.symbol, `CP ${extreme.cp.toFixed(2)}`],
  ];
  return `<section class="tape-panel" id="sessionTape">
    <div class="tape-main">
      <p class="kicker">${t("tapeKicker")}</p>
      <h2>${esc(headline(day, index))}</h2>
      <p class="sub">${t("vsPrior")} ${signedPct(dod)} · CP ${day.marketCp.toFixed(2)} · ${t("leaders")} ${esc(heads)}</p>
    </div>
    <div class="chips">${chips.map((chip) => `<div class="chip">${chip[0]}<b>${chip[1]}</b><small>${chip[2]}</small></div>`).join("")}</div>
    <div class="ranks">${ranks.map(([id, label, value, series]) => {
      const p = percentile(series, value);
      const rank = rankHigh(series, value);
      return `<div class="rank">${term(id, label)}<b>P${p.toFixed(1)}</b><small>${bandLabel(p)} #${rank} / ${series.length}</small></div>`;
    }).join("")}</div>
  </section>`;
}

function stkWeight(day) {
  return day.categories.STOCK.volume / day.totalVol;
}

function spineHtml(day, index) {
  const points = rotationPoints(day, index);
  const up = points.filter((p) => p.x > 0 && p.y > 0).length;
  const down = points.filter((p) => p.x < 0 && p.y < 0).length;
  const bulls = day.flows.filter((card) => card.side === "Bullish").length;
  const bears = day.flows.filter((card) => card.side === "Bearish").length;
  const cards = [
    ["01", "reportSector", t("overview"), formatVol(day.totalVol), `${day.date} · ${formatPremium(day.totalPremium)}`],
    ["02", "flowSector", t("flow"), `${bulls} Bull / ${bears} Bear`, t("flowHint")],
    ["03", "historySector", t("history"), `${DATA.days.length}${state.lang === "zh" ? "日" : "d"}`, `${up} ${t("heatCount")} · ${down} ${t("coolCount")}`],
  ];
  return `<nav class="spine" aria-label="${t("views")}">${cards.map((card) => `<button type="button" data-jump="${card[1]}"><span class="idx">${card[0]}</span><strong>${card[3]}</strong><span>${card[2]}</span><span>${card[4]}</span></button>`).join("")}</nav>`;
}

function sheetTable(rows) {
  const body = rows.map((row, i) => `<tr data-symbol="${row.symbol}" class="${row.symbol === state.focus ? "is-focus" : ""}"><td>${i + 1}</td><td class="sym">${row.symbol}</td><td>${wan1(row.volume)}</td><td style="background:${cpHeat(row.cp)}">${row.cp.toFixed(2)}</td></tr>`).join("");
  return `<table class="sheet-table"><thead><tr><th>Rank</th><th>Symbol</th><th>${term("volWan")}</th><th>${term("cpRatio")}</th></tr></thead><tbody>${body}</tbody></table>`;
}

function sheetBars(day) {
  const max = Math.max(...day.buckets.map((b) => b.total));
  return `<div class="sheet-bars">${day.buckets.map((bucket) => `<div class="sheet-bar"><span class="bv">${wan1(bucket.total)}</span><div class="bv-track"><i style="height:${(bucket.total / max) * 100}%"></i></div><span class="bt">${bucket.t}</span></div>`).join("")}</div>`;
}

function stockRowsHtml(day) {
  const rows = filteredStocks(day);
  if (!rows.length) return `<tr><td colspan="6" class="empty">${t("emptyFilter")}</td></tr>`;
  return rows.map((row, i) => `<tr data-symbol="${row.symbol}" class="${row.symbol === state.focus ? "is-focus" : ""}"><td>${i + 1}</td><td>${row.symbol}</td><td>${formatVol(row.volume)}</td><td style="background:${cpHeat(row.cp)}">${row.cp.toFixed(2)}</td><td>${formatPremium(row.premium)}</td><td>${esc(row.hottestShort)}</td></tr>`).join("");
}

function workbenchHtml(day) {
  const sorts = [["volume", "sortVol", "volWan"], ["premium", "sortPrem", "premCol"], ["cp", "sortCp", "cpRatio"], ["avg", "sortAvg", "avgSize"]];
  return `<section class="workbench jump-target" id="reportSector">
    <div class="sheet-stage">
      <h2>${t("reportCanvas")}</h2>
      <p class="sub">${t("reportHint")}</p>
      <article class="sheet" id="reportCanvas">
        <header class="sheet-head">
          <div>
            <h3>${esc(sheetTitle(day))}</h3>
            <p class="credit">${t("sheetCredit")}</p>
          </div>
          <div class="sheet-badge">KZG</div>
        </header>
        <section class="sheet-section"><h4>${t("indexTape")}</h4>${sheetTable(day.leaders.index)}</section>
        <section class="sheet-section"><h4>${t("intraday")}</h4>${sheetBars(day)}</section>
        <section class="sheet-section"><h4>${t("etfTop")}</h4>${sheetTable(day.leaders.etf.slice(0, 10))}</section>
        <section class="sheet-section"><h4>${t("stockTop10")}</h4>${sheetTable(day.leaders.stock.slice(0, 10))}</section>
      </article>
    </div>
    <aside class="rail">
      <h2>${t("tapeSummary")}</h2>
      <p class="sub">${t("tapeHint")}</p>
      <label class="sub" for="symbolSearch">${t("filterNames")}</label>
      <input id="symbolSearch" class="search" value="${esc(state.query)}" placeholder="NVDA / TSLA / AAPL" autocomplete="off">
      <div class="digest" id="digest">${digestLines(day).map((line) => `<p>${esc(line)}</p>`).join("")}</div>
      <h3>${t("stockTop25")}</h3>
      <div class="sort-tabs" id="stockSortTabs">${sorts.map(([id, key, note]) => `<div class="sort-item"><button type="button" data-sort="${id}" class="${state.sort === id ? "is-on" : ""}">${t(key)}</button><button type="button" class="note-mark" data-note="${note}" data-note-jump="${note}" aria-label="?">?</button></div>`).join("")}</div>
      <div class="table-scroll"><table class="rail-table" id="stockTable"><thead><tr><th>Rank</th><th>Symbol</th><th>${term("volWan", t("sortVol"))}</th><th>${term("cpRatio", "CP")}</th><th>${term("premCol")}</th><th>${term("hottest")}</th></tr></thead><tbody id="stockTableBody">${stockRowsHtml(day)}</tbody></table></div>
    </aside>
  </section>`;
}

function flowHtml(day) {
  const bulls = day.flows.filter((card) => card.side === "Bullish").length;
  const bears = day.flows.filter((card) => card.side === "Bearish").length;
  const cards = filteredFlows(day);
  const presets = ["all", "Bullish", "Bearish", "Sweep", "Block", "Split"];
  const dirOpts = ["all", "Bullish", "Bearish", "Neutral"].map((value) => `<option value="${value}" ${state.flowDir === value ? "selected" : ""}>${value === "all" ? t("all") : value}</option>`).join("");
  const premOpts = [["all", t("all")], ["10m", "≥ $10M"], ["100m", "≥ $100M"], ["1b", "≥ $1B"]].map(([value, label]) => `<option value="${value}" ${state.flowPrem === value ? "selected" : ""}>${label}</option>`).join("");
  const structOpts = ["all", "Sweep", "Block", "Split"].map((value) => `<option value="${value}" ${state.flowStruct === value ? "selected" : ""}>${value === "all" ? t("all") : value}</option>`).join("");
  const list = cards.length ? cards.map((card) => `<article class="flow-card">
      <header><time>${card.time}</time><span>CP ${card.cp.toFixed(2)}</span></header>
      <button type="button" class="symbtn" data-symbol="${card.symbol}">${card.symbol}</button>
      <div class="side-${card.side}">${term("bullBear", card.side)}</div>
      <div>${term("structure", card.structure)}</div>
      <p class="flow-prem">${formatPremium(card.premium)}</p>
      <p class="sub">${esc(card.contract)}</p>
    </article>`).join("") : `<p class="empty">${t("noFlow")}</p>`;
  return `<section class="panel jump-target" id="flowSector" style="margin-top:14px">
    <div class="flow-head"><div><p class="kicker">${t("flow")}</p><h2>${t("flow")}</h2></div><div class="flow-count">${term("bullBear", `${bulls} Bull / ${bears} Bear`)}</div></div>
    <div class="command-row">${presets.map((name) => `<button type="button" data-flow="${name}">${name === "all" ? t("all") : name}</button>`).join("")}</div>
    <div class="filters">
      <label>${term("bullBear", t("direction"))}<select id="flowDir">${dirOpts}</select></label>
      <label>${term("premCol", t("premiumFilter"))}<select id="flowPrem">${premOpts}</select></label>
      <label>${term("structure", t("structureFilter"))}<select id="flowStruct">${structOpts}</select></label>
    </div>
    <div class="flow-grid" id="flowList">${list}</div>
  </section>`;
}

function trendSvg(slice) {
  const w = 720;
  const h = 230;
  const padL = 8;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const vals = slice.map((d) => d.totalPremium);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = (i) => padL + (i * (w - padL - padR)) / Math.max(1, slice.length - 1);
  const y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
  const line = slice.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.totalPremium).toFixed(1)}`).join(" ");
  const area = `${line} L${x(slice.length - 1).toFixed(1)},${h - padB} L${x(0).toFixed(1)},${h - padB} Z`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img"><path d="${area}" fill="var(--gold-soft)"></path><path d="${line}" fill="none" stroke="var(--ink)" stroke-width="1.7"></path><text x="${padL}" y="${h - 8}" font-size="11" fill="var(--muted)">${slice[0].date.slice(5)}</text><text x="${w - padR}" y="${h - 8}" text-anchor="end" font-size="11" fill="var(--muted)">${slice[slice.length - 1].date.slice(5)}</text></svg>`;
}

function gaugeSvg(score) {
  const len = Math.PI * 46;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * len;
  return `<svg class="gauge" viewBox="0 0 120 72" role="img" aria-label="${score}"><path d="M14,62 A46,46 0 0 1 106,62" fill="none" stroke="var(--line)" stroke-width="8" stroke-linecap="round"></path><path d="M14,62 A46,46 0 0 1 106,62" fill="none" stroke="var(--gold)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${len.toFixed(2)}"></path><text x="60" y="58" text-anchor="middle" fill="var(--ink)" font-size="18" font-family="Georgia, serif">${score}</text></svg>`;
}

function heatmapHtml(day) {
  const head = `<div></div>${DATA.meta.times.map((time) => `<div class="hm-time">${time}</div>`).join("")}`;
  const rows = day.heatmap.map((row) => {
    const max = Math.max(...row.buckets, 1);
    const cells = row.buckets.map((value) => {
      const height = 8 + (value / max) * 26;
      const color = mix(state.theme === "dark" ? "#3a3228" : "#f3ead7", state.theme === "dark" ? "#d8a84b" : "#9a6a12", value / max);
      return `<div class="hm-cell" data-symbol="${row.symbol}"><i style="height:${height.toFixed(1)}px;background:${color}"></i></div>`;
    }).join("");
    return `<button type="button" class="hm-sym ${row.symbol === state.focus ? "is-focus" : ""}" data-symbol="${row.symbol}">${row.symbol}</button>${cells}`;
  }).join("");
  return `<div class="hm">${head}${rows}</div>`;
}

function bucketChartHtml(day, index) {
  const ghost = ghostBuckets(index);
  const max = Math.max(...day.buckets.map((b) => b.total), ...ghost, 1);
  return `<div class="bucket-chart">${day.buckets.map((bucket, i) => `<div class="bkt"><div>${wan1(bucket.total)}</div><div class="bkt-stage"><i class="ghost" style="height:${(ghost[i] / max) * 100}%"></i><i class="fill" style="height:${(bucket.total / max) * 100}%"></i></div><div>${bucket.t}</div></div>`).join("")}</div>`;
}

function rotationSvg(points) {
  if (!points.length) return `<p class="empty">${t("na")}</p>`;
  const w = 520;
  const h = 300;
  const pad = 28;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(-30, ...xs);
  const x1 = Math.max(30, ...xs);
  const y0 = Math.min(-30, ...ys);
  const y1 = Math.max(30, ...ys);
  const X = (v) => pad + ((v - x0) / (x1 - x0 || 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - y0) / (y1 - y0 || 1)) * (h - pad * 2);
  const zx = X(0);
  const zy = Y(0);
  let axes = "";
  if (zx > pad && zx < w - pad) axes += `<line x1="${zx}" y1="${pad}" x2="${zx}" y2="${h - pad}" stroke="var(--line-strong)"></line>`;
  if (zy > pad && zy < h - pad) axes += `<line x1="${pad}" y1="${zy}" x2="${w - pad}" y2="${zy}" stroke="var(--line-strong)"></line>`;
  const labeled = new Set(points.slice().sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y)).slice(0, 6).map((p) => p.symbol));
  labeled.add(state.focus);
  const dots = points.map((p) => `<circle data-symbol="${p.symbol}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.symbol === state.focus ? 5.5 : 3.4}" fill="${p.symbol === state.focus ? "var(--gold)" : "var(--ink)"}"></circle>`).join("");
  const texts = points.filter((p) => labeled.has(p.symbol)).map((p) => `<text x="${(X(p.x) + 6).toFixed(1)}" y="${(Y(p.y) - 6).toFixed(1)}" font-size="11" fill="var(--ink)">${esc(p.symbol)}</text>`).join("");
  return `<svg class="scatter" viewBox="0 0 ${w} ${h}">${axes}${dots}${texts}</svg>`;
}

function sparkSvg(symbol, index) {
  const series = symbolHistory(symbol).slice(Math.max(0, index - 29), index + 1).map((row) => (row ? row.volume : null));
  const nums = series.filter((v) => v != null);
  if (nums.length < 2) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const cmds = [];
  series.forEach((value, i) => {
    if (value == null) return;
    const x = (i / Math.max(1, series.length - 1)) * 100;
    const y = 32 - ((value - min) / (max - min || 1)) * 28;
    cmds.push(`${cmds.length ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return `<svg viewBox="0 0 100 36" preserveAspectRatio="none"><path d="${cmds.join(" ")}" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg>`;
}

function focusBits(day, index) {
  const points = rotationPoints(day, index);
  const point = points.find((item) => item.symbol === state.focus);
  let quad = t("na");
  if (point && point.x > 0 && point.y > 0) quad = t("upQuad");
  else if (point && point.x < 0 && point.y < 0) quad = t("downQuad");
  else if (point) quad = t("mixedQuad");
  const sparks = sparkSymbols(day);
  const rank = sparks.indexOf(state.focus);
  return { quad, rank: rank >= 0 ? `#${rank + 1}` : "—", point };
}

function inspectorHtml(day, index) {
  const row = leaderMap(day).get(state.focus);
  if (!row) return `<p class="empty">${t("na")}</p>`;
  const volMean = priorMean(row.symbol, index, "volume");
  const chg = volMean ? row.volume / volMean - 1 : null;
  const items = [
    [term("volWan", t("sortVol")), formatVol(row.volume)],
    [term("premCol"), formatPremium(row.premium)],
    [term("cpRatio", "CP"), row.cp.toFixed(2)],
    [term("hottest"), esc(row.hottestShort)],
    [term("rotX", t("chg20")), signedPct(chg)],
    [term("avgSize"), String(row.avgSize)],
    [term("trades"), row.txn.toLocaleString("en-US")],
  ];
  return items.map(([label, value]) => `<div>${label}<b>${value}</b></div>`).join("");
}

function analysisHtml(day, index) {
  const span = state.window === "ALL" ? index + 1 : Math.min(WINDOWS[state.window], index + 1);
  const slice = DATA.days.slice(index + 1 - span, index + 1);
  const winVols = slice.map((d) => d.totalVol);
  const winP = percentile(winVols, day.totalVol);
  const prev = slice.length > 1 ? slice[slice.length - 2] : null;
  const dod = prev ? day.totalPremium / prev.totalPremium - 1 : null;
  const score = tapeTemperature(day);
  const volP = percentile(DATA.days.map((d) => d.totalVol), day.totalVol);
  const ppcSeries = DATA.days.map((d) => d.totalPremium / d.totalVol);
  const ppcP = percentile(ppcSeries, day.totalPremium / day.totalVol);
  const cpP = percentile(DATA.days.map((d) => d.marketCp), day.marketCp);
  const dom = dominant(day);
  const meters = [
    ["volPercentile", `P${volP.toFixed(0)}`, volP],
    ["premDensity", formatPremium(day.totalPremium / day.totalVol), ppcP],
    ["openConc", `${(openShare(day) * 100).toFixed(1)}%`, Math.min(100, (openShare(day) / 0.4) * 100)],
    ["closeConc", `${(closeShare(day) * 100).toFixed(1)}%`, Math.min(100, (closeShare(day) / 0.25) * 100)],
    ["leadCat", `${catName(dom.key)} ${(dom.share * 100).toFixed(1)}%`, dom.share * 100],
    ["cpStruct", `${day.marketCp.toFixed(2)} · P${cpP.toFixed(0)}`, cpP],
  ];
  const n = Math.min(120, DATA.days.length);
  const start = Math.min(Math.max(0, index - Math.floor(n / 2)), DATA.days.length - n);
  const band = DATA.days.slice(start, start + n);
  const zs = zScores(band.map((d) => d.totalVol));
  const cells = band.map((d, i) => `<button type="button" class="temp-cell ${d.date === state.date ? "is-on" : ""}" data-date="${d.date}" style="background:${zColor(zs[i])}" aria-label="${d.date}"></button>`).join("");
  const points = rotationPoints(day, index);
  const up = points.filter((p) => p.x > 0 && p.y > 0).length;
  const down = points.filter((p) => p.x < 0 && p.y < 0).length;
  const bits = focusBits(day, index);
  const pulses = [
    extremeDate("totalVol"),
    extremeDate("totalPremium"),
    DATA.meta.latest,
  ];
  const pulseLabels = [t("pulseVol"), t("pulsePrem"), t("pulseLatest")];
  const sparks = sparkSymbols(day).map((symbol) => `<button type="button" class="spark ${symbol === state.focus ? "is-focus" : ""}" data-spark="${symbol}"><b>${symbol}</b>${sparkSvg(symbol, index)}<span>${formatVol(leaderMap(day).get(symbol).volume)}</span></button>`).join("");
  return `<section class="jump-target" id="historySector">
    <div class="intro">
      <div>
        <p class="kicker">${t("historyTitle")}</p>
        <div class="intro-stats"><div><b>${DATA.days.length}</b><span>${t("session")}</span></div><div><b>${formatPremium(day.totalPremium)}</b><span>${day.date}</span></div><div><b>${up} / ${down}</b><span>${t("heatCount")} / ${t("coolCount")}</span></div></div>
      </div>
      <div class="jump-chips">
        <button type="button" data-jump="trendPanel">${t("window")}</button>
        <button type="button" data-jump="heatStrip">${NOTES.heatStrip[state.lang].title}</button>
        <button type="button" data-jump="heatmapPanel">${NOTES.heatmap[state.lang].title}</button>
        <button type="button" data-jump="rotationPanel">${t("pathRot")}</button>
      </div>
    </div>
    <div class="analysis">
      <section class="panel jump-target" id="trendPanel">
        <div class="windows">${term("windows", t("window"))}${"30D,90D,1Y,ALL".split(",").map((w) => `<button type="button" data-window="${w}" class="${state.window === w ? "is-on" : ""}">${w}</button>`).join("")}</div>
        <h3>${t("sortPrem")}</h3>
        ${trendSvg(slice)}
        <div class="kpi-row">
          <div>${term("premCol")}<b>${formatPremium(day.totalPremium)}</b></div>
          <div>${t("vsPrior")}<b>${signedPct(dod)}</b></div>
          <div>${term("windowPct")}<b>P${winP.toFixed(1)}</b></div>
        </div>
        <div class="command-row">${pulses.map((iso, i) => `<button type="button" data-date="${iso}">${pulseLabels[i]}</button>`).join("")}</div>
      </section>
      <section class="panel">
        <p class="kicker">${term("tapeTemp")}</p>
        <div class="gauge-wrap">${gaugeSvg(score)}<div><b style="font-family:var(--display);font-size:28px">${score}</b><div class="sub">0–100</div></div></div>
        <div class="meters">${meters.map(([id, text, width]) => `<div class="meter"><div class="meter-top">${term(id)}<b>${text}</b></div><div class="meter-track"><i style="width:${Math.max(0, Math.min(100, width))}%"></i></div></div>`).join("")}</div>
      </section>
      <section class="panel wide jump-target" id="heatStrip">
        <h3>${term("heatStrip")}</h3>
        <div class="temp-scale"><span>${band[0].date}</span><span>${band[band.length - 1].date}</span></div>
        <div class="temp-band">${cells}</div>
      </section>
      <section class="panel jump-target" id="heatmapPanel">
        <h3>${term("heatmap")}</h3>
        <p class="sub">${t("unitWan")}</p>
        ${heatmapHtml(day)}
      </section>
      <section class="panel" id="bucketPanel">
        <h3>${t("intraday")}</h3>
        <p class="sub">${term("ghostBar")}</p>
        ${bucketChartHtml(day, index)}
      </section>
      <section class="panel jump-target" id="rotationPanel">
        <h3>${t("pathRot")}</h3>
        <p>${term("quadCounts")}</p>
        <p class="legend-row">${term("heatQuad")} <b>${up}</b> · ${term("coolQuad")} <b>${down}</b></p>
        <div class="rot-layout"><div class="rot-y">${term("rotY")}</div><div id="rotationPlot">${rotationSvg(points)}</div></div>
        <div>${term("rotX")}</div>
      </section>
      <section class="panel" id="momentumPanel">
        <h3>${term("spark")}</h3>
        <p class="focus-path" id="focusPath">${t("pathRot")} ${esc(bits.quad)} → ${t("pathLens")} ${esc(state.focus)} → ${t("pathQueue")} ${bits.rank}</p>
        <div class="inspector" id="inspector">${inspectorHtml(day, index)}</div>
        <div class="spark-row">${sparks}</div>
      </section>
    </div>
  </section>`;
}

function extremeDate(field) {
  let best = 0;
  DATA.days.forEach((day, i) => {
    if (day[field] > DATA.days[best][field]) best = i;
  });
  return DATA.days[best].date;
}

function restHtml() {
  const day = current();
  const index = dateIndex(day.date);
  if (!leaderMap(day).has(state.focus)) state.focus = day.leaders.index[0].symbol;
  return metricsHtml(day, index) + tapeHtml(day, index) + spineHtml(day, index) + workbenchHtml(day) + flowHtml(day) + analysisHtml(day, index);
}

function renderRest() {
  const focused = document.activeElement && document.activeElement.id === "symbolSearch";
  const pos = focused ? document.activeElement.selectionStart : null;
  document.getElementById("rest").innerHTML = restHtml();
  if (focused) {
    const el = document.getElementById("symbolSearch");
    if (el) {
      el.focus();
      if (pos != null) el.setSelectionRange(pos, pos);
    }
  }
}

function renderTimeline() {
  const vols = DATA.days.map((d) => d.totalVol);
  const min = Math.min(...vols);
  const max = Math.max(...vols);
  const bars = DATA.days.map((day) => {
    const tRatio = (day.totalVol - min) / (max - min || 1);
    const height = Math.round(10 + tRatio * 42);
    const color = mix(state.theme === "dark" ? "#3a342b" : "#e7e1d4", state.theme === "dark" ? "#d8a84b" : "#9a6a12", tRatio);
    return `<button type="button" data-date="${day.date}" style="height:${height}px;background:${color}" aria-label="${day.date}"></button>`;
  }).join("");
  const index = dateIndex(state.date);
  document.getElementById("timelineSlot").innerHTML = `<section class="timeline">
    <div class="timeline-head">
      <h2>${t("timeline")}</h2>
      <div class="timeline-tools">
        <button type="button" class="button" id="prevDay" ${index <= 0 ? "disabled" : ""}>‹</button>
        <button type="button" class="date-chip" id="datePickerTrigger">${t("selected")} <span id="selectedDateLabel">${state.date}</span></button>
        <button type="button" class="button" id="nextDay" ${index >= DATA.days.length - 1 ? "disabled" : ""}>›</button>
      </div>
    </div>
    <p class="range-line"><span id="timelineStart">${DATA.meta.rangeStart}</span> ${t("to")} <span id="timelineEnd">${DATA.meta.rangeEnd}</span></p>
    <div class="day-strip" id="dayBars">${bars}</div>
    <div class="month-ticks">${monthTicks()}</div>
    <input id="timelineRange" class="slider" type="range" min="0" max="${DATA.days.length - 1}" value="${index}" aria-label="${t("timeline")}">
    <div class="legend">
      <span><i class="dot on"></i>${t("selected")}</span>
      <span><i class="dot has"></i>${t("hasData")}</span>
      <span><i class="dot none"></i>${t("noData")}</span>
      <span class="sub">${t("openCal")}</span>
    </div>
  </section>`;
  document.getElementById("prevDay").addEventListener("click", () => shiftDay(-1));
  document.getElementById("nextDay").addEventListener("click", () => shiftDay(1));
  document.getElementById("datePickerTrigger").addEventListener("click", openCal);
}

function monthTicks() {
  let html = "";
  let prev = "";
  DATA.days.forEach((day, i) => {
    const key = day.date.slice(0, 7);
    if (key === prev) return;
    const month = Number(key.slice(5));
    const yearChanged = !prev || prev.slice(0, 4) !== key.slice(0, 4);
    const label = state.lang === "zh"
      ? `${yearChanged ? key.slice(2, 4) + "年" : ""}${month}月`
      : `${MONTHS[month - 1]}${yearChanged ? " " + key.slice(2, 4) : ""}`;
    html += `<span style="left:${(i / DATA.days.length) * 100}%">${label}</span>`;
    prev = key;
  });
  return html;
}

function paintTimelineSelection() {
  const index = dateIndex(state.date);
  document.querySelectorAll("#dayBars [data-date]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.date === state.date);
  });
  const label = document.getElementById("selectedDateLabel");
  if (label) label.textContent = state.date;
  const prev = document.getElementById("prevDay");
  const next = document.getElementById("nextDay");
  if (prev) prev.disabled = index <= 0;
  if (next) next.disabled = index >= DATA.days.length - 1;
  const range = document.getElementById("timelineRange");
  if (range && Number(range.value) !== index) range.value = String(index);
}

function setDate(iso) {
  if (!dateSet.has(iso) || !DATA) return;
  state.date = iso;
  paintChrome();
  paintTimelineSelection();
  renderRest();
}

function shiftDay(delta) {
  const next = dateIndex(state.date) + delta;
  if (next < 0 || next >= DATA.days.length) return;
  setDate(DATA.days[next].date);
}

function renderStockBody() {
  const body = document.getElementById("stockTableBody");
  if (body) body.innerHTML = stockRowsHtml(current());
}

function paintSort() {
  document.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.sort === state.sort);
  });
}

function paintFocus() {
  document.querySelectorAll("[data-symbol]").forEach((el) => {
    el.classList.toggle("is-focus", el.dataset.symbol === state.focus);
  });
  document.querySelectorAll("[data-spark]").forEach((el) => {
    el.classList.toggle("is-focus", el.dataset.spark === state.focus);
  });
  const day = current();
  const index = dateIndex(day.date);
  const path = document.getElementById("focusPath");
  const bits = focusBits(day, index);
  if (path) path.textContent = `${t("pathRot")} ${bits.quad} → ${t("pathLens")} ${state.focus} → ${t("pathQueue")} ${bits.rank}`;
  const inspector = document.getElementById("inspector");
  if (inspector) inspector.innerHTML = inspectorHtml(day, index);
  const plot = document.getElementById("rotationPlot");
  if (plot) plot.innerHTML = rotationSvg(rotationPoints(day, index));
}

function openCal() {
  const [y, m] = state.date.split("-").map(Number);
  state.calY = y;
  state.calM = m;
  renderCalendar();
  document.getElementById("calModal").hidden = false;
}

function closeCal() {
  document.getElementById("calModal").hidden = true;
}

function renderCalendar() {
  const y = state.calY;
  const m = state.calM;
  document.getElementById("calLabel").textContent = state.lang === "zh" ? `${y}年${m}月` : `${MONTHS[m - 1]} ${y}`;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dows = state.lang === "zh" ? ["一", "二", "三", "四", "五", "六", "日"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  let html = dows.map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < pad; i += 1) html += `<button type="button" disabled></button>`;
  for (let d = 1; d <= dim; d += 1) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const has = dateSet.has(iso);
    html += `<button type="button" ${has ? `data-date="${iso}"` : "disabled"} class="${has ? "has" : ""} ${iso === state.date ? "is-on" : ""}">${d}</button>`;
  }
  document.getElementById("calGrid").innerHTML = html;
  const min = DATA.days[0].date.slice(0, 7);
  const max = DATA.days[DATA.days.length - 1].date.slice(0, 7);
  const cur = `${y}-${String(m).padStart(2, "0")}`;
  document.getElementById("calPrev").disabled = cur <= min;
  document.getElementById("calNext").disabled = cur >= max;
}

function shiftMonth(delta) {
  let m = state.calM + delta;
  let y = state.calY;
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1; y += 1; }
  state.calM = m;
  state.calY = y;
  renderCalendar();
}

function renderNotes(targetId) {
  const lang = state.lang;
  const groups = NOTE_SECTIONS.map((section) => {
    const items = Object.entries(NOTES).filter(([, note]) => note.section === section.id).map(([id, note]) => {
      const pack = note[lang];
      return `<article class="note-item" id="note-${id}"><h4>${esc(pack.title)}</h4><p>${esc(pack.body)}</p></article>`;
    }).join("");
    return `<section class="note-group"><h3>${esc(section[lang])}</h3>${items}</section>`;
  }).join("");
  document.getElementById("notesDialog").innerHTML = `<div class="notes-bar"><h2 id="notesTitle">${esc(t("notes"))}</h2><button type="button" class="button" id="notesClose">${esc(t("close"))}</button></div><div class="notes-body">${groups}<p class="notes-disclaimer">${esc(DISCLAIMER[lang])}</p></div>`;
  if (targetId) {
    const el = document.getElementById("note-" + targetId);
    if (el) el.classList.add("is-target");
  }
}

function openNotes(id) {
  renderNotes(id);
  const dialog = document.getElementById("notesDialog");
  if (!dialog.open) dialog.showModal();
  hideTip();
  if (id) {
    const el = document.getElementById("note-" + id);
    if (el) el.scrollIntoView({ block: "center" });
  }
}

function showTip(el) {
  const id = el && el.dataset ? el.dataset.note : "";
  if (!id || !NOTES[id]) return;
  const tip = document.getElementById("tooltip");
  tip.textContent = NOTES[id][state.lang].tip;
  tip.hidden = false;
  const rect = el.getBoundingClientRect();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  let left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  let top = rect.bottom + 8;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
  tip.style.left = left + "px";
  tip.style.top = top + "px";
}

function hideTip() {
  document.getElementById("tooltip").hidden = true;
}

function drawPngTable(ctx, x, y, width, title, rows) {
  ctx.fillStyle = "#111";
  ctx.font = "600 16px 'WenQuanYi Micro Hei', sans-serif";
  ctx.fillText(title, x, y);
  y += 16;
  const cols = [70, 160, 220, width - 70 - 160 - 220];
  const headers = ["Rank", "Symbol", state.lang === "zh" ? "成交量(万张)" : "Volume (10k)", "CP"];
  ctx.font = "12px 'WenQuanYi Micro Hei', sans-serif";
  ctx.fillStyle = "#111";
  let cx = x;
  headers.forEach((header, i) => {
    ctx.fillText(header, cx + 6, y + 16);
    cx += cols[i];
  });
  y += 24;
  ctx.strokeStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  rows.forEach((row, i) => {
    const bg = i % 2 ? "#f3f1ea" : "#ffffff";
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, width, 26);
    ctx.fillStyle = cpHeat(row.cp);
    ctx.fillRect(x + cols[0] + cols[1] + cols[2], y, cols[3], 26);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + cols[0], y, cols[1], 26);
    ctx.fillStyle = "#111";
    ctx.font = "13px 'WenQuanYi Micro Hei', sans-serif";
    const values = [String(i + 1), row.symbol, wan1(row.volume), row.cp.toFixed(2)];
    cx = x;
    values.forEach((value, col) => {
      ctx.font = col === 1 ? "700 13px 'WenQuanYi Micro Hei', sans-serif" : "13px 'WenQuanYi Micro Hei', sans-serif";
      ctx.fillText(value, cx + 6, y + 17);
      cx += cols[col];
    });
    y += 26;
  });
  return y + 8;
}

function drawPngBars(ctx, x, y, width, day) {
  ctx.fillStyle = "#111";
  ctx.font = "600 16px 'WenQuanYi Micro Hei', sans-serif";
  ctx.fillText(state.lang === "zh" ? "全市场日内成交分布" : "Intraday distribution", x, y);
  y += 12;
  const max = Math.max(...day.buckets.map((b) => b.total));
  const gap = 8;
  const barW = (width - gap * 12) / 13;
  const base = y + 120;
  day.buckets.forEach((bucket, i) => {
    const h = Math.max(2, (bucket.total / max) * 100);
    const bx = x + i * (barW + gap);
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(bx, base - h, barW, h);
    ctx.fillStyle = "#333";
    ctx.font = "10px 'WenQuanYi Micro Hei', sans-serif";
    ctx.fillText(wan1(bucket.total), bx, base - h - 4);
    ctx.fillStyle = "#666";
    ctx.fillText(bucket.t, bx, base + 14);
  });
  return base + 28;
}

function drawSheet(day) {
  const width = 1100;
  const indexes = day.leaders.index;
  const etf = day.leaders.etf.slice(0, 10);
  const stocks = day.leaders.stock.slice(0, 10);
  const tableH = (n) => 48 + n * 26;
  const height = 120 + tableH(indexes.length) + 200 + tableH(etf.length) + tableH(stocks.length) + 80;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#111";
  ctx.font = "500 26px Georgia, 'WenQuanYi Micro Hei', serif";
  ctx.fillText(sheetTitle(day), 36, 58);
  ctx.font = "13px 'WenQuanYi Micro Hei', sans-serif";
  ctx.fillStyle = "#6f716b";
  ctx.fillText("口罩哥独家数据整理 | KZG Option House", 36, 80);
  let y = 110;
  y = drawPngTable(ctx, 36, y, width - 72, state.lang === "zh" ? "三大指数期权数据" : "Index options", indexes);
  y = drawPngBars(ctx, 36, y + 8, width - 72, day);
  y = drawPngTable(ctx, 36, y + 8, width - 72, "ETF Top", etf);
  drawPngTable(ctx, 36, y + 8, width - 72, state.lang === "zh" ? "个股 Top10" : "Single-name Top 10", stocks);
  return canvas;
}

function exportDataUrl() {
  return drawSheet(current()).toDataURL("image/png");
}

function exportPng() {
  const day = current();
  const canvas = drawSheet(day);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kzg-option-house-${day.date}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  });
}

function runSelfTest() {
  const errors = [];
  try {
    const trade = document.getElementById("tradeDate").textContent.trim();
    if (trade !== "2026-09-25") errors.push("date:" + trade);
    const vol = document.getElementById("totalVol").textContent;
    if (!vol.includes("7,263.0万")) errors.push("vol:" + vol);
    const table = document.getElementById("stockTable").textContent;
    if (!table.includes("TSLA") || !table.includes("NVDA")) errors.push("table");
    document.getElementById("notesOpen").click();
    const dialog = document.getElementById("notesDialog");
    if (!dialog.open) errors.push("notes-closed");
    const title = document.getElementById("notesTitle").textContent.trim();
    if (title !== "指标说明") errors.push("zh-title:" + title);
    const mark = document.querySelector("#metricRail .note-mark");
    if (!mark) errors.push("no-mark");
    else mark.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const tip = document.getElementById("tooltip");
    if (tip.hidden || tip.textContent.trim().length < 8) errors.push("tip:" + tip.textContent);
    document.getElementById("langToggle").click();
    const titleEn = document.getElementById("notesTitle").textContent.trim();
    if (titleEn !== "Notes") errors.push("en-title:" + titleEn);
    document.getElementById("themeToggle").click();
    if (!document.documentElement.hasAttribute("dark")) errors.push("no-dark");
    const url = exportDataUrl();
    const bin = atob(url.split(",")[1]);
    const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bin.charCodeAt(i) === b);
    if (!magic || bin.length < 5000) errors.push("png:" + bin.length);
    const pre = document.getElementById("selftest");
    pre.hidden = false;
    const msg = errors.length ? "SELFTEST FAIL " + errors.join(" | ") : "SELFTEST PASS png=" + bin.length;
    pre.textContent = msg;
    document.title = msg.slice(0, 140);
  } catch (err) {
    const pre = document.getElementById("selftest");
    pre.hidden = false;
    pre.textContent = "SELFTEST FAIL throw:" + err.message;
    document.title = pre.textContent.slice(0, 140);
  }
}

function bind() {
  document.getElementById("goToday").addEventListener("click", () => {
    if (DATA) setDate(DATA.meta.latest);
  });
  document.getElementById("themeToggle").addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    if (DATA) {
      renderTimeline();
      renderRest();
    }
  });
  document.getElementById("langToggle").addEventListener("click", () => setLang(state.lang === "zh" ? "en" : "zh"));
  document.getElementById("notesOpen").addEventListener("click", () => openNotes());
  document.getElementById("downloadReport").addEventListener("click", () => {
    if (DATA) exportPng();
  });
  document.getElementById("notesDialog").addEventListener("click", (event) => {
    if (event.target.id === "notesDialog") event.target.close();
  });
  document.getElementById("calModal").addEventListener("click", (event) => {
    if (event.target.id === "calModal") closeCal();
  });
  document.getElementById("calPrev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("calNext").addEventListener("click", () => shiftMonth(1));
  document.addEventListener("click", (event) => {
    if (event.target.id === "notesClose" || (event.target.closest && event.target.closest("#notesClose"))) {
      document.getElementById("notesDialog").close();
      return;
    }
    const noteJump = event.target.closest && event.target.closest("[data-note-jump]");
    if (noteJump) {
      event.preventDefault();
      event.stopPropagation();
      openNotes(noteJump.dataset.noteJump);
      return;
    }
    const jump = event.target.closest && event.target.closest("[data-jump]");
    if (jump) {
      const el = document.getElementById(jump.dataset.jump);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const sort = event.target.closest && event.target.closest("[data-sort]");
    if (sort) {
      state.sort = sort.dataset.sort;
      renderStockBody();
      paintSort();
      return;
    }
    const win = event.target.closest && event.target.closest("[data-window]");
    if (win) {
      state.window = win.dataset.window;
      renderRest();
      return;
    }
    const preset = event.target.closest && event.target.closest("[data-flow]");
    if (preset) {
      const kind = preset.dataset.flow;
      if (kind === "all") {
        state.flowDir = "all";
        state.flowStruct = "all";
      } else if (kind === "Bullish" || kind === "Bearish") {
        state.flowDir = kind;
        state.flowStruct = "all";
      } else {
        state.flowStruct = kind;
        state.flowDir = "all";
      }
      renderRest();
      return;
    }
    const spark = event.target.closest && event.target.closest("[data-spark]");
    if (spark) {
      state.focus = spark.dataset.spark;
      paintFocus();
      return;
    }
    const sym = event.target.closest && event.target.closest("[data-symbol]");
    if (sym && sym.dataset.symbol) {
      state.focus = sym.dataset.symbol;
      paintFocus();
      return;
    }
    const dayEl = event.target.closest && event.target.closest("[data-date]");
    if (dayEl && dayEl.dataset.date) {
      setDate(dayEl.dataset.date);
      closeCal();
    }
  });
  document.addEventListener("input", (event) => {
    if (!DATA) return;
    if (event.target.id === "timelineRange") {
      state.date = DATA.days[Number(event.target.value)].date;
      paintChrome();
      paintTimelineSelection();
      renderRest();
    }
    if (event.target.id === "symbolSearch") {
      state.query = event.target.value;
      renderStockBody();
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "flowDir") state.flowDir = event.target.value;
    if (event.target.id === "flowPrem") state.flowPrem = event.target.value;
    if (event.target.id === "flowStruct") state.flowStruct = event.target.value;
    if (["flowDir", "flowPrem", "flowStruct"].includes(event.target.id)) renderRest();
  });
  document.addEventListener("mouseover", (event) => {
    const card = event.target.closest && event.target.closest("[data-spark]");
    if (card && DATA && card.dataset.spark !== state.focus) {
      state.focus = card.dataset.spark;
      paintFocus();
    }
    const note = event.target.closest && event.target.closest("[data-note]");
    if (note) showTip(note);
  });
  document.addEventListener("mouseout", (event) => {
    const note = event.target.closest && event.target.closest("[data-note]");
    if (!note) return;
    const next = event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest("[data-note]");
    if (next !== note) hideTip();
  });
  document.addEventListener("focusin", (event) => {
    const note = event.target.closest && event.target.closest("[data-note]");
    if (note) showTip(note);
  });
  document.addEventListener("focusout", () => hideTip());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCal();
    if (!DATA) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (document.getElementById("notesDialog").open) return;
    if (!document.getElementById("calModal").hidden) return;
    event.preventDefault();
    shiftDay(event.key === "ArrowLeft" ? -1 : 1);
  });
  window.addEventListener("scroll", hideTip, true);
}

function boot(payload) {
  DATA = payload;
  dateIndexMap = new Map(DATA.days.map((day, i) => [day.date, i]));
  dateSet = new Set(DATA.days.map((day) => day.date));
  histCache.clear();
  state.date = DATA.meta.latest;
  state.focus = "SPY";
  paintChrome();
  renderTimeline();
  renderRest();
  if (new URLSearchParams(location.search).has("selftest")) setTimeout(runSelfTest, 40);
}

bind();
state.theme = localStorage.getItem("kzg-theme") === "dark" ? "dark" : "light";
state.lang = localStorage.getItem("kzg-lang") === "en" ? "en" : "zh";
applyTheme(state.theme);
setLang(state.lang);

fetch("data/report.json")
  .then((res) => {
    if (!res.ok) throw new Error("report.json " + res.status);
    return res.json();
  })
  .then(boot)
  .catch((err) => {
    document.getElementById("rest").innerHTML = `<p class="boot-error">${esc(err.message)}</p>`;
  });

window.KZG = { exportDataUrl, exportPng };
