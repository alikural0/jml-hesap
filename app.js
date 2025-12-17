/* JML Hesap • V5.0
   - Splash 2sn (splash.png varsa birebir, yoksa logo)
   - Sonra Ana Panel (Home)
   - Home’dan tıklanınca panel geçişi
   - Menü (☰) ve backdrop
   - Hesap makineleri + hesap modülleri
*/

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  currency: "TRY",
  expr: "0",
  lastResult: null,
};

function setBodyMode(tab){
  document.body.classList.toggle("mode-home", tab === "home");
}

function openMenu(){
  $("#menuBackdrop").classList.add("open");
  $("#menu").classList.add("open");
}
function closeMenu(){
  $("#menuBackdrop").classList.remove("open");
  $("#menu").classList.remove("open");
}

function setActiveMenuButton(tab){
  $$("#menu button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
}

function showPanel(tab){
  // tab -> panel id map
  const map = {
    home: "panel-home",
    calc: "panel-calc",
    kdv: "panel-kdv",
    pct: "panel-pct",
    profit: "panel-profit",
    fx: "panel-fx",
    export: "panel-export",
    raise: "panel-raise",
    comments: "panel-comments",
  };

  $$(".panel").forEach(p => p.classList.remove("active"));
  const pid = map[tab] || "panel-home";
  const el = document.getElementById(pid);
  if (el) el.classList.add("active");

  setBodyMode(tab);
  setActiveMenuButton(tab);
  closeMenu();

  // küçük info
  if (tab === "calc") updateMiniInfo();
}

function splashThenHome(){
  // 2sn splash
  setTimeout(() => {
    const splash = $("#splash");
    if (splash) splash.style.display = "none";
    showPanel("home");
  }, 2000);
}

/* ---------- Number parse/format (TR+US) ---------- */

function parseSmartNumber(input){
  if (typeof input !== "string") input = String(input ?? "");
  let s = input.trim();
  if (!s) return NaN;

  // Remove currency symbols/spaces
  s = s.replace(/[₺$€£\s]/g, "");

  // If contains both . and , decide decimal by last occurrence
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1){
    if (lastComma > lastDot){
      // 1.234,56 -> thousands '.' remove, decimal ',' -> '.'
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // 1,234.56 -> thousands ',' remove
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1){
    // treat comma as decimal if looks like decimal
    // 123,45 -> decimal
    // 1.234,56 handled above
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else {
    // only dot or none: remove thousands commas just in case
    s = s.replace(/,/g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatNumber(n, digits=2){
  if (!Number.isFinite(n)) return "—";
  const nf = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return nf.format(n);
}

function currencySymbol(){
  return state.currency === "USD" ? "$" : "₺";
}

function formatMoney(n, digits=2){
  if (!Number.isFinite(n)) return "—";
  return `${currencySymbol()} ${formatNumber(n, digits)}`;
}

/* ---------- Calculator ---------- */

function sanitizeExprToEval(expr){
  // allowed: digits, dot, operators + - * / % parentheses
  // our UI supplies safe tokens. Still sanitize:
  const s = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/[^\d.+\-*/()%]/g, "");
  return s;
}

function evalExpr(expr){
  const s = sanitizeExprToEval(expr);

  // block dangerous patterns
  if (!/^[\d.+\-*/()%]*$/.test(s)) return NaN;

  // Avoid empty
  if (!s || s === "." || s === "-" || s === "+") return NaN;

  // Use Function on sanitized math-only string
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${s});`)();
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

function setScreenValueText(text){
  $("#screen").value = text;
}

function setExpr(newExpr){
  state.expr = newExpr;
  // show raw expr but prettify operators for UI
  setScreenValueText(prettyExprForScreen(newExpr));
  updateMiniInfo();
}

function prettyExprForScreen(expr){
  // Replace * / - with nicer display where suitable
  return expr
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/-/g, "−");
}

function getCurrentNumberFromScreen(){
  // if expression has operators, try last token; else parse whole
  const raw = state.expr;
  const m = raw.match(/(\d+(\.\d+)?)$/);
  if (m) return Number(m[1]);
  const v = parseSmartNumber(raw);
  return v;
}

function updateMiniInfo(){
  const info = $("#miniInfo");
  if (!info) return;
  const v = evalExpr(state.expr);
  if (Number.isFinite(v)) info.textContent = `= ${formatMoney(v, 2)}`;
  else info.textContent = "—";
}

function calcInputToken(token){
  let e = state.expr;

  if (e === "0" && /[0-9]/.test(token)) e = token;
  else if (token === "."){
    // prevent two dots in same number token
    const lastNum = e.split(/[\+\-\*\/%]/).pop() ?? "";
    if (!lastNum.includes(".")) e += ".";
  } else {
    // operators
    const ops = "+-*/%";
    if (ops.includes(token)){
      // avoid double operator
      if (ops.includes(e.slice(-1))) e = e.slice(0, -1) + token;
      else e += token;
    } else {
      e += token;
    }
  }

  setExpr(e);
}

function calcClear(){
  state.lastResult = null;
  setExpr("0");
}

function calcBackspace(){
  let e = state.expr;
  if (e.length <= 1) return calcClear();
  e = e.slice(0, -1);
  if (!e) e = "0";
  setExpr(e);
}

function calcEquals(){
  const v = evalExpr(state.expr);
  if (!Number.isFinite(v)) return;
  state.lastResult = v;
  // show formatted number as expression
  setExpr(String(v));
  // screen prettier number
  setScreenValueText(formatNumber(v, 6));
  updateMiniInfo();
}

/* ---------- Tabs / Home wiring ---------- */

function bindMenu(){
  $("#menuBtn").addEventListener("click", () => {
    const isOpen = $("#menu").classList.contains("open");
    if (isOpen) closeMenu(); else openMenu();
  });
  $("#menuBackdrop").addEventListener("click", closeMenu);

  $$("#menu button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      showPanel(tab);
    });
  });

  $("#homeOpenMenu").addEventListener("click", openMenu);
  $("#homeCloseApp").addEventListener("click", () => showPanel("home"));

  // Home list click -> show panel
  $$(".homeRow").forEach(row => {
    row.addEventListener("click", () => showPanel(row.dataset.tab));
  });
}

/* ---------- Currency selector ---------- */

function bindCurrency(){
  const sel = $("#currency");
  state.currency = sel.value || "TRY";
  sel.addEventListener("change", () => {
    state.currency = sel.value || "TRY";
    updateMiniInfo();
  });
}

/* ---------- KDV ---------- */
function bindKdv(){
  $("#netToBrut").addEventListener("click", () => {
    const rate = parseSmartNumber($("#kdvRate").value) / 100;
    const base = evalExpr(state.expr);
    if (!Number.isFinite(base)) return $("#kdvOut").textContent = "Ekrandaki sayı geçersiz.";
    const brut = base * (1 + rate);
    $("#kdvOut").innerHTML =
      `Net: <b>${formatMoney(base)}</b><br>` +
      `Brüt: <b>${formatMoney(brut)}</b><br>` +
      `KDV: <b>${formatMoney(brut - base)}</b>`;
  });

  $("#brutToNet").addEventListener("click", () => {
    const rate = parseSmartNumber($("#kdvRate").value) / 100;
    const brut = evalExpr(state.expr);
    if (!Number.isFinite(brut)) return $("#kdvOut").textContent = "Ekrandaki sayı geçersiz.";
    const net = brut / (1 + rate);
    $("#kdvOut").innerHTML =
      `Brüt: <b>${formatMoney(brut)}</b><br>` +
      `Net: <b>${formatMoney(net)}</b><br>` +
      `KDV: <b>${formatMoney(brut - net)}</b>`;
  });
}

/* ---------- Percent ---------- */
function bindPercent(){
  const getA = () => parseSmartNumber($("#baseA").value);
  const getB = () => parseSmartNumber($("#percB").value);

  $("#aOfB").addEventListener("click", () => {
    const A = getA(), B = getB();
    if (!Number.isFinite(A) || !Number.isFinite(B)) return $("#percOut").textContent = "A ve B gir.";
    const r = A * (B/100);
    $("#percOut").innerHTML = `A'nın %B'si = <b>${formatMoney(r)}</b>`;
  });

  $("#aPlusB").addEventListener("click", () => {
    const A = getA(), B = getB();
    if (!Number.isFinite(A) || !Number.isFinite(B)) return $("#percOut").textContent = "A ve B gir.";
    const r = A * (1 + B/100);
    $("#percOut").innerHTML = `A + %B = <b>${formatMoney(r)}</b>`;
  });

  $("#aMinusB").addEventListener("click", () => {
    const A = getA(), B = getB();
    if (!Number.isFinite(A) || !Number.isFinite(B)) return $("#percOut").textContent = "A ve B gir.";
    const r = A * (1 - B/100);
    $("#percOut").innerHTML = `A - %B = <b>${formatMoney(r)}</b>`;
  });
}

/* ---------- Profit ---------- */
function bindProfit(){
  $("#profitCalc").addEventListener("click", () => {
    const cost = parseSmartNumber($("#cost").value);
    const sell = parseSmartNumber($("#sell").value);
    if (!Number.isFinite(cost) || !Number.isFinite(sell)) return $("#profitOut").textContent = "Maliyet ve satış gir.";

    const profit = sell - cost;
    const profitPct = cost !== 0 ? (profit / cost) * 100 : NaN;
    const marginPct = sell !== 0 ? (profit / sell) * 100 : NaN;

    $("#profitOut").innerHTML =
      `Kâr/Zarar: <b>${formatMoney(profit)}</b><br>` +
      `Kâr% (maliyet): <b>${Number.isFinite(profitPct) ? formatNumber(profitPct,2) + "%" : "—"}</b><br>` +
      `Marj% (satış): <b>${Number.isFinite(marginPct) ? formatNumber(marginPct,2) + "%" : "—"}</b>`;
  });

  $("#swap").addEventListener("click", () => {
    const a = $("#cost").value;
    $("#cost").value = $("#sell").value;
    $("#sell").value = a;
  });
}

/* ---------- FX ---------- */
function bindFx(){
  $("#fxUseUSDTRY").addEventListener("click", () => $("#fxRate").value = $("#fxRate").value || "35,50");
  $("#fxUseEURTRY").addEventListener("click", () => $("#fxRate").value = $("#fxRate").value || "38,50");

  $("#fxConvert").addEventListener("click", () => {
    const rate = parseSmartNumber($("#fxRate").value);
    const amt  = parseSmartNumber($("#fxAmount").value);
    const from = $("#fxFrom").value;
    const to   = $("#fxTo").value;

    if (!Number.isFinite(rate) || rate <= 0) return $("#fxOut").textContent = "Kur geçersiz.";
    if (!Number.isFinite(amt)) return $("#fxOut").textContent = "Tutar geçersiz.";

    // rate = 1 USD/EUR = ? TRY
    let out = NaN;

    const isBase = (c) => (c === "USD" || c === "EUR"); // biz rate'i base->TRY kabul ediyoruz
    // Basit mantık: USD->TRY veya EUR->TRY dönüşümleri için rate kullan
    if (from === "TRY" && isBase(to)) out = amt / rate;
    else if (isBase(from) && to === "TRY") out = amt * rate;
    else if (isBase(from) && isBase(to)) out = amt; // USD->EUR gibi için burada oran yok; aynı bırak
    else if (from === "TRY" && to === "TRY") out = amt;

    if (!Number.isFinite(out)) return $("#fxOut").textContent = "Bu dönüşüm için oran yok (şimdilik).";

    $("#fxOut").innerHTML = `${formatNumber(amt,2)} ${from} → <b>${formatNumber(out,2)} ${to}</b>`;
  });
}

/* ---------- Export ---------- */
function bindExport(){
  function calcExport(){
    const incoterm = $("#incoterm").value;
    const cur = $("#expCur").value;

    const goods = parseSmartNumber($("#goodsValue").value) || 0;
    const freight = parseSmartNumber($("#freight").value) || 0;
    const ins = parseSmartNumber($("#insurance").value) || 0;

    const inland = parseSmartNumber($("#inland").value) || 0;
    const port = parseSmartNumber($("#portFees").value) || 0;
    const commPct = parseSmartNumber($("#commissionPct").value) || 0;

    const qty = parseSmartNumber($("#qty").value);
    const unitPrice = parseSmartNumber($("#unitPrice").value);

    const commission = goods * (commPct/100);
    const FOB = goods + inland + port + commission;
    const CFR = FOB + freight;
    const CIF = CFR + ins;

    let base;
    if (incoterm === "FOB") base = FOB;
    else if (incoterm === "CFR") base = CFR;
    else if (incoterm === "CIF") base = CIF;
    else base = goods; // EXW approx

    const unitCost = Number.isFinite(qty) && qty > 0 ? (base / qty) : NaN;
    const unitSale = Number.isFinite(qty) && qty > 0 && Number.isFinite(unitPrice) ? (unitPrice) : NaN;
    const totalSale = Number.isFinite(qty) && qty > 0 && Number.isFinite(unitPrice) ? (unitPrice * qty) : NaN;

    const f = (n) => (Number.isFinite(n) ? formatNumber(n,2) : "—");

    $("#expOut").innerHTML =
      `Para birimi: <b>${cur}</b><br>` +
      `Komisyon: <b>${f(commission)}</b><br>` +
      `FOB: <b>${f(FOB)}</b> • CFR: <b>${f(CFR)}</b> • CIF: <b>${f(CIF)}</b><br>` +
      `${incoterm} Toplam: <b>${f(base)}</b><br>` +
      `Birim maliyet: <b>${Number.isFinite(unitCost) ? f(unitCost) : "—"}</b><br>` +
      `Birim satış: <b>${Number.isFinite(unitSale) ? f(unitSale) : "—"}</b> • Toplam satış: <b>${Number.isFinite(totalSale) ? f(totalSale) : "—"}</b>`;
  }

  $("#expCalc").addEventListener("click", calcExport);

  $("#priceWithProfit").addEventListener("click", () => {
    // önce maliyeti hesapla
    const goods = parseSmartNumber($("#goodsValue").value) || 0;
    const freight = parseSmartNumber($("#freight").value) || 0;
    const ins = parseSmartNumber($("#insurance").value) || 0;
    const inland = parseSmartNumber($("#inland").value) || 0;
    const port = parseSmartNumber($("#portFees").value) || 0;
    const commPct = parseSmartNumber($("#commissionPct").value) || 0;

    const commission = goods * (commPct/100);
    const FOB = goods + inland + port + commission;
    const CIF = (FOB + freight) + ins;

    const baseSel = $("#profitBase").value; // FOB or CIF
    const profitPct = parseSmartNumber($("#targetProfitPct").value);

    if (!Number.isFinite(profitPct)) return $("#expOut").textContent = "Hedef kâr % gir.";

    const base = baseSel === "CIF" ? CIF : FOB;
    const sale = base * (1 + profitPct/100);

    $("#expOut").innerHTML =
      `Baz: <b>${baseSel}</b><br>` +
      `Baz tutar: <b>${formatNumber(base,2)}</b><br>` +
      `Hedef kâr: <b>${formatNumber(profitPct,2)}%</b><br>` +
      `Hedef satış: <b>${formatNumber(sale,2)}</b>`;
  });
}

/* ---------- Raise ---------- */
function bindRaise(){
  $("#raiseCalc").addEventListener("click", () => {
    const oldS = parseSmartNumber($("#oldSalary").value);
    const newS = parseSmartNumber($("#newSalary").value);

    if (!Number.isFinite(oldS) || !Number.isFinite(newS) || oldS <= 0){
      return $("#raiseOut").textContent = "Mevcut ve yeni maaş gir (mevcut > 0).";
    }

    const diff = newS - oldS;
    const pct = (diff / oldS) * 100;

    let msg = "Hayırlı olsun.";
    if (pct >= 50) msg = "Moris bey iyi misiniz?";
    else if (pct >= 40) msg = "Personel çıldırdı ofisten çıkmıyor";
    else if (pct >= 30) msg = "Personel mutlu, enflasyon düşünsün";
    else if (pct >= 20) msg = "Ağanın Eli tutulmaz";

    $("#raiseOut").innerHTML =
      `Artış: <b>${formatMoney(diff)}</b><br>` +
      `Zam oranı: <b>${formatNumber(pct,2)}%</b><br>` +
      `<b>${msg}</b>`;
  });
}

/* ---------- Comments (Firebase) ---------- */
async function initComments(){
  // firebase-comments.js içinden init çağırmayı dener
  const statusEl = $("#cStatus");
  const listEl = $("#cList");
  const nameEl = $("#cName");
  const textEl = $("#cText");
  const sendBtn = $("#cSend");

  try{
    const mod = await import("./firebase-comments.js");
    if (mod && typeof mod.initFirebaseComments === "function"){
      mod.initFirebaseComments({ statusEl, listEl, nameEl, textEl, sendBtn });
      return;
    }
  }catch(e){
    // ignore
  }

  // fallback (firebase yoksa)
  statusEl.textContent = "Firebase bağlı değil (firebase-comments.js ayarla).";
  listEl.textContent = "—";
  sendBtn.addEventListener("click", () => {
    statusEl.textContent = "Firebase bağlı değil.";
  });
}

/* ---------- Keyboard ---------- */
function bindKeyboard(){
  window.addEventListener("keydown", (e) => {
    const isCalcOpen = $("#panel-calc").classList.contains("active");
    if (!isCalcOpen) return;

    if (e.key === "Enter"){ e.preventDefault(); calcEquals(); }
    else if (e.key === "Backspace"){ e.preventDefault(); calcBackspace(); }
    else if (e.key === "Escape"){ e.preventDefault(); calcClear(); }
    else if ("0123456789".includes(e.key)) calcInputToken(e.key);
    else if (e.key === ".") calcInputToken(".");
    else if ("+-*/%".includes(e.key)) calcInputToken(e.key);
  });
}

/* ---------- Grid click ---------- */
function bindCalcGrid(){
  $("#grid").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    if (action === "clear") return calcClear();
    if (action === "back") return calcBackspace();
    if (action === "equals") return calcEquals();

    if (value){
      // normalize display operators to internal
      if (value === "×") return calcInputToken("*");
      if (value === "÷") return calcInputToken("/");
      if (value === "−") return calcInputToken("-");
      return calcInputToken(value);
    }
  });
}

/* ---------- Boot ---------- */
function boot(){
  // Service worker (varsa)
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  bindMenu();
  bindCurrency();

  // calc
  bindCalcGrid();
  bindKeyboard();
  calcClear();

  // modules
  bindKdv();
  bindPercent();
  bindProfit();
  bindFx();
  bindExport();
  bindRaise();

  // comments
  initComments();

  // start
  splashThenHome();
}

window.addEventListener("load", boot);
