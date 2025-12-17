/* JML Hesap • V5.0
   - Splash 2sn (splash.png)
   - Sonra Ana Panel (Home)
   - Home’dan tıklanınca panel geçişi
   - Menü (☰) ve backdrop
   - Hesap makinesi + modüller
   - Firebase yorumlar: firebase-comments.js içinden initFirebaseComments çağrılır
*/

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const on = (sel, ev, fn) => {
  const el = $(sel);
  if (el) el.addEventListener(ev, fn);
};

const state = {
  currency: "TRY",
  expr: "0",
  lastResult: null,
};

function setBodyMode(tab){
  document.body.classList.toggle("mode-home", tab === "home");
}

function openMenu(){
  const bd = $("#menuBackdrop");
  const m = $("#menu");
  if (bd) bd.classList.add("open");
  if (m) m.classList.add("open");
}
function closeMenu(){
  const bd = $("#menuBackdrop");
  const m = $("#menu");
  if (bd) bd.classList.remove("open");
  if (m) m.classList.remove("open");
}

function setActiveMenuButton(tab){
  $$("#menu button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
}

function showPanel(tab){
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

  if (tab === "calc") updateMiniInfo();
}

function splashThenHome(){
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

  s = s.replace(/[₺$€£\s]/g, "");

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1){
    if (lastComma > lastDot){
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1){
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else {
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
  return expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/[^\d.+\-*/()%]/g, "");
}

function evalExpr(expr){
  const s = sanitizeExprToEval(expr);

  if (!/^[\d.+\-*/()%]*$/.test(s)) return NaN;
  if (!s || s === "." || s === "-" || s === "+") return NaN;

  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${s});`)();
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

function setScreenValueText(text){
  const scr = $("#screen");
  if (scr) scr.value = text;
}

function setExpr(newExpr){
  state.expr = newExpr;
  setScreenValueText(prettyExprForScreen(newExpr));
  updateMiniInfo();
}

function prettyExprForScreen(expr){
  return expr
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/-/g, "−");
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
    const lastNum = e.split(/[\+\-\*\/%]/).pop() ?? "";
    if (!lastNum.includes(".")) e += ".";
  } else {
    const ops = "+-*/%";
    if (ops.includes(token)){
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
  setExpr(String(v));

  // ekranda daha düzgün görünmesi için
  setScreenValueText(formatNumber(v, 6));
  updateMiniInfo();
}

/* ---------- Menu / Home wiring ---------- */

function bindMenu(){
  on("#menuBtn", "click", () => {
    const menu = $("#menu");
    if (!menu) return;
    const isOpen = menu.classList.contains("open");
    if (isOpen) closeMenu(); else openMenu();
  });

  on("#menuBackdrop", "click", closeMenu);

  // Menü butonları
  $$("#menu button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      showPanel(tab);
    });
  });

  // Home üst mini butonlar
  on("#homeOpenMenu", "click", openMenu);
  on("#homeCloseApp", "click", () => showPanel("home"));

  // Home liste
  $$(".homeRow").forEach(row => {
    row.addEventListener("click", () => {
      const t = row.dataset.tab;
      if (t) showPanel(t);
    });
  });
}

/* ---------- Currency selector ---------- */

function bindCurrency(){
  const sel = $("#currency");
  if (!sel) return;
  state.currency = sel.value || "TRY";
  sel.addEventListener("change", () => {
    state.currency = sel.value || "TRY";
    updateMiniInfo();
  });
}

/* ---------- KDV ---------- */
function bindKdv(){
  on("#netToBrut","click", () => {
    const rateSel = $("#kdvRate");
    const out = $("#kdvOut");
    if (!rateSel || !out) return;

    const rate = parseSmartNumber(rateSel.value) / 100;
    const base = evalExpr(state.expr);
    if (!Number.isFinite(base)) return out.textContent = "Ekrandaki sayı geçersiz.";
    const brut = base * (1 + rate);
    out.innerHTML =
      `Net: <b>${formatMoney(base)}</b><br>` +
      `Brüt: <b>${formatMoney(brut)}</b><br>` +
      `KDV: <b>${formatMoney(brut - base)}</b>`;
  });

  on("#brutToNet","click", () => {
    const rateSel = $("#kdvRate");
    const out = $("#kdvOut");
    if (!rateSel || !out) return;

    const rate = parseSmartNumber(rateSel.value) / 100;
    const brut = evalExpr(state.expr);
    if (!Number.isFinite(brut)) return out.textContent = "Ekrandaki sayı geçersiz.";
    const net = brut / (1 + rate);
    out.innerHTML =
      `Brüt: <b>${formatMoney(brut)}</b><br>` +
      `Net: <b>${formatMoney(net)}</b><br>` +
      `KDV: <b>${formatMoney(brut - net)}</b>`;
  });
}

/* ---------- Percent ---------- */
function bindPercent(){
  const out = () => $("#percOut");
  const getA = () => parseSmartNumber($("#baseA")?.value ?? "");
  const getB = () => parseSmartNumber($("#percB")?.value ?? "");

  on("#aOfB","click", () => {
    const A = getA(), B = getB();
    const o = out(); if (!o) return;
    if (!Number.isFinite(A) || !Number.isFinite(B)) return o.textContent = "A ve B gir.";
    const r = A * (B/100);
    o.innerHTML = `A'nın %B'si = <b>${formatMoney(r)}</b>`;
  });

  on("#aPlusB","click", () => {
    const A = getA(), B = getB();
    const o = out(); if (!o) return;
    if (!Number.isFinite(A) || !Number.isFinite(B)) return o.textContent = "A ve B gir.";
    const r = A * (1 + B/100);
    o.innerHTML = `A + %B = <b>${formatMoney(r)}</b>`;
  });

  on("#aMinusB","click", () => {
    const A = getA(), B = getB();
    const o = out(); if (!o) return;
    if (!Number.isFinite(A) || !Number.isFinite(B)) return o.textContent = "A ve B gir.";
    const r = A * (1 - B/100);
    o.innerHTML = `A - %B = <b>${formatMoney(r)}</b>`;
  });
}

/* ---------- Profit ---------- */
function bindProfit(){
  on("#profitCalc","click", () => {
    const out = $("#profitOut");
    const costEl = $("#cost");
    const sellEl = $("#sell");
    if (!out || !costEl || !sellEl) return;

    const cost = parseSmartNumber(costEl.value);
    const sell = parseSmartNumber(sellEl.value);
    if (!Number.isFinite(cost) || !Number.isFinite(sell)) return out.textContent = "Maliyet ve satış gir.";

    const profit = sell - cost;
    const profitPct = cost !== 0 ? (profit / cost) * 100 : NaN;
    const marginPct = sell !== 0 ? (profit / sell) * 100 : NaN;

    out.innerHTML =
      `Kâr/Zarar: <b>${formatMoney(profit)}</b><br>` +
      `Kâr% (maliyet): <b>${Number.isFinite(profitPct) ? formatNumber(profitPct,2) + "%" : "—"}</b><br>` +
      `Marj% (satış): <b>${Number.isFinite(marginPct) ? formatNumber(marginPct,2) + "%" : "—"}</b>`;
  });

  on("#swap","click", () => {
    const costEl = $("#cost");
    const sellEl = $("#sell");
    if (!costEl || !sellEl) return;
    const a = costEl.value;
    costEl.value = sellEl.value;
    sellEl.value = a;
  });
}

/* ---------- FX ---------- */
function bindFx(){
  on("#fxUseUSDTRY","click", () => {
    const r = $("#fxRate"); if (!r) return;
    r.value = r.value || "35,50";
  });
  on("#fxUseEURTRY","click", () => {
    const r = $("#fxRate"); if (!r) return;
    r.value = r.value || "38,50";
  });

  on("#fxConvert","click", () => {
    const out = $("#fxOut");
    const rateEl = $("#fxRate");
    const amtEl = $("#fxAmount");
    const fromEl = $("#fxFrom");
    const toEl = $("#fxTo");
    if (!out || !rateEl || !amtEl || !fromEl || !toEl) return;

    const rate = parseSmartNumber(rateEl.value);
    const amt  = parseSmartNumber(amtEl.value);
    const from = fromEl.value;
    const to   = toEl.value;

    if (!Number.isFinite(rate) || rate <= 0) return out.textContent = "Kur geçersiz.";
    if (!Number.isFinite(amt)) return out.textContent = "Tutar geçersiz.";

    let converted = NaN;
    const isBase = (c) => (c === "USD" || c === "EUR");

    if (from === "TRY" && isBase(to)) converted = amt / rate;
    else if (isBase(from) && to === "TRY") converted = amt * rate;
    else if (from === "TRY" && to === "TRY") converted = amt;
    else if (isBase(from) && isBase(to)) converted = amt; // oran yok

    if (!Number.isFinite(converted)) return out.textContent = "Bu dönüşüm için oran yok (şimdilik).";
    out.innerHTML = `${formatNumber(amt,2)} ${from} → <b>${formatNumber(converted,2)} ${to}</b>`;
  });
}

/* ---------- Export ---------- */
function bindExport(){
  const outEl = () => $("#expOut");

  function calcExport(){
    const out = outEl(); if (!out) return;

    const incotermEl = $("#incoterm");
    const curEl = $("#expCur");
    if (!incotermEl || !curEl) return;

    const incoterm = incotermEl.value;
    const cur = curEl.value;

    const goods = parseSmartNumber($("#goodsValue")?.value ?? "") || 0;
    const freight = parseSmartNumber($("#freight")?.value ?? "") || 0;
    const ins = parseSmartNumber($("#insurance")?.value ?? "") || 0;

    const inland = parseSmartNumber($("#inland")?.value ?? "") || 0;
    const port = parseSmartNumber($("#portFees")?.value ?? "") || 0;
    const commPct = parseSmartNumber($("#commissionPct")?.value ?? "") || 0;

    const qty = parseSmartNumber($("#qty")?.value ?? "");
    const unitPrice = parseSmartNumber($("#unitPrice")?.value ?? "");

    const commission = goods * (commPct/100);
    const FOB = goods + inland + port + commission;
    const CFR = FOB + freight;
    const CIF = CFR + ins;

    let base;
    if (incoterm === "FOB") base = FOB;
    else if (incoterm === "CFR") base = CFR;
    else if (incoterm === "CIF") base = CIF;
    else base = goods;

    const unitCost = Number.isFinite(qty) && qty > 0 ? (base / qty) : NaN;
    const totalSale = Number.isFinite(qty) && qty > 0 && Number.isFinite(unitPrice) ? (unitPrice * qty) : NaN;

    const f = (n) => (Number.isFinite(n) ? formatNumber(n,2) : "—");

    out.innerHTML =
      `Para birimi: <b>${cur}</b><br>` +
      `Komisyon: <b>${f(commission)}</b><br>` +
      `FOB: <b>${f(FOB)}</b> • CFR: <b>${f(CFR)}</b> • CIF: <b>${f(CIF)}</b><br>` +
      `${incoterm} Toplam: <b>${f(base)}</b><br>` +
      `Birim maliyet: <b>${Number.isFinite(unitCost) ? f(unitCost) : "—"}</b><br>` +
      `Toplam satış: <b>${Number.isFinite(totalSale) ? f(totalSale) : "—"}</b>`;
  }

  on("#expCalc","click", calcExport);

  on("#priceWithProfit","click", () => {
    const out = outEl(); if (!out) return;
    const baseSelEl = $("#profitBase");
    const profitEl = $("#targetProfitPct");
    if (!baseSelEl || !profitEl) return;

    const goods = parseSmartNumber($("#goodsValue")?.value ?? "") || 0;
    const freight = parseSmartNumber($("#freight")?.value ?? "") || 0;
    const ins = parseSmartNumber($("#insurance")?.value ?? "") || 0;
    const inland = parseSmartNumber($("#inland")?.value ?? "") || 0;
    const port = parseSmartNumber($("#portFees")?.value ?? "") || 0;
    const commPct = parseSmartNumber($("#commissionPct")?.value ?? "") || 0;

    const commission = goods * (commPct/100);
    const FOB = goods + inland + port + commission;
    const CIF = (FOB + freight) + ins;

    const baseSel = baseSelEl.value;
    const profitPct = parseSmartNumber(profitEl.value);

    if (!Number.isFinite(profitPct)) return out.textContent = "Hedef kâr % gir.";

    const base = baseSel === "CIF" ? CIF : FOB;
    const sale = base * (1 + profitPct/100);

    out.innerHTML =
      `Baz: <b>${baseSel}</b><br>` +
      `Baz tutar: <b>${formatNumber(base,2)}</b><br>` +
      `Hedef kâr: <b>${formatNumber(profitPct,2)}%</b><br>` +
      `Hedef satış: <b>${formatNumber(sale,2)}</b>`;
  });
}

/* ---------- Raise ---------- */
function bindRaise(){
  on("#raiseCalc","click", () => {
    const out = $("#raiseOut");
    const oldEl = $("#oldSalary");
    const newEl = $("#newSalary");
    if (!out || !oldEl || !newEl) return;

    const oldS = parseSmartNumber(oldEl.value);
    const newS = parseSmartNumber(newEl.value);

    if (!Number.isFinite(oldS) || !Number.isFinite(newS) || oldS <= 0){
      return out.textContent = "Mevcut ve yeni maaş gir (mevcut > 0).";
    }

    const diff = newS - oldS;
    const pct = (diff / oldS) * 100;

    let msg = "Hayırlı olsun.";
    if (pct >= 50) msg = "Moris bey iyi misiniz?";
    else if (pct >= 40) msg = "Personel çıldırdı ofisten çıkmıyor";
    else if (pct >= 30) msg = "Personel mutlu, enflasyon düşünsün";
    else if (pct >= 20) msg = "Ağanın Eli tutulmaz";

    out.innerHTML =
      `Artış: <b>${formatMoney(diff)}</b><br>` +
      `Zam oranı: <b>${formatNumber(pct,2)}%</b><br>` +
      `<b>${msg}</b>`;
  });
}

/* ---------- Comments (Firebase) ---------- */
async function initComments(){
  const statusEl = $("#cStatus");
  const listEl = $("#cList");
  const nameEl = $("#cName");
  const textEl = $("#cText");
  const sendBtn = $("#cSend");

  if (!statusEl || !listEl || !nameEl || !textEl || !sendBtn) return;

  try{
    const mod = await import("./firebase-comments.js");
    if (mod && typeof mod.initFirebaseComments === "function"){
      mod.initFirebaseComments({ statusEl, listEl, nameEl, textEl, sendBtn });
      return;
    }
  }catch(e){
    // ignore
  }

  statusEl.textContent = "Firebase bağlı değil (firebase-comments.js ayarla).";
  listEl.textContent = "—";
  sendBtn.addEventListener("click", () => {
    statusEl.textContent = "Firebase bağlı değil.";
  });
}

/* ---------- Keyboard ---------- */
function bindKeyboard(){
  window.addEventListener("keydown", (e) => {
    const calcPanel = $("#panel-calc");
    if (!calcPanel || !calcPanel.classList.contains("active")) return;

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
  const grid = $("#grid");
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    if (action === "clear") return calcClear();
    if (action === "back") return calcBackspace();
    if (action === "equals") return calcEquals();

    if (value){
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

  bindCalcGrid();
  bindKeyboard();
  calcClear();

  bindKdv();
  bindPercent();
  bindProfit();
  bindFx();
  bindExport();
  bindRaise();

  initComments();

  splashThenHome();
}

window.addEventListener("load", boot);
