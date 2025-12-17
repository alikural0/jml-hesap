(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  const state = {
    tab: "calc",
    currency: "TRY",
    expr: "0",
    fxUSDTRY: 35.50,
    fxEURTRY: 38.50,
  };

  function isLikelyTR(s){ return (s.includes(",") && !s.includes(".")) || /,\d{1,2}$/.test(s); }

  function parseNumber(raw){
    if(raw == null) return NaN;
    let s = String(raw).trim();
    if(!s) return NaN;
    s = s.replace(/\s/g, "");

    // if both separators exist, decide by last separator
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if(lastComma !== -1 && lastDot !== -1){
      if(lastComma > lastDot){
        // 1.234,56 -> TR
        s = s.replace(/\./g, "").replace(",", ".");
      }else{
        // 1,234.56 -> US
        s = s.replace(/,/g, "");
      }
      return Number(s);
    }

    if(isLikelyTR(s)){
      s = s.replace(/\./g, "").replace(",", ".");
      return Number(s);
    }

    // US-ish
    s = s.replace(/,/g, "");
    return Number(s);
  }

  function fmt(n){
    if(!Number.isFinite(n)) return "—";
    const opts = { maximumFractionDigits: 2 };
    const locale = "tr-TR";
    return new Intl.NumberFormat(locale, opts).format(n);
  }

  function money(n){
    const sym = state.currency === "USD" ? "$" : "₺";
    return `${sym} ${fmt(n)}`;
  }

  // ---------- menu / tab ----------
  const menuBtn = $("menuBtn");
  const menu = $("menu");
  const menuBackdrop = $("menuBackdrop");

  function openMenu(){
    menu.classList.add("open");
    menuBackdrop.classList.add("open");
  }
  function closeMenu(){
    menu.classList.remove("open");
    menuBackdrop.classList.remove("open");
  }
  menuBtn?.addEventListener("click", () => {
    if(menu.classList.contains("open")) closeMenu();
    else openMenu();
  });
  menuBackdrop?.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeMenu();
  });

  function switchTab(tab){
    state.tab = tab;

    // panels
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    const panel = $(`panel-${tab}`);
    if(panel) panel.classList.add("active");

    // menu active
    menu?.querySelectorAll("button[data-tab]").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    closeMenu();
  }

  menu?.querySelectorAll("button[data-tab]")?.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // ---------- currency ----------
  const currencySel = $("currency");
  currencySel?.addEventListener("change", () => {
    state.currency = currencySel.value || "TRY";
    updateMiniInfo();
  });

  // ---------- calculator ----------
  const screen = $("screen");
  const grid = $("grid");
  const miniInfo = $("miniInfo");

  function setScreenText(text){
    if(!screen) return;
    screen.value = text;
  }

  function updateMiniInfo(){
    if(!miniInfo) return;
    const n = safeEval(state.expr);
    if(Number.isFinite(n)) miniInfo.textContent = money(n);
    else miniInfo.textContent = "—";
  }

  function safeEval(expr){
    try{
      const s = expr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/[^\d+\-*/().%]/g, "");

      if(!s) return NaN;
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${s});`)();
      return Number(val);
    }catch{
      return NaN;
    }
  }

  function pushValue(v){
    if(state.expr === "0" && /[0-9.]/.test(v)) state.expr = v === "." ? "0." : v;
    else state.expr += v;
    setScreenText(prettyExpr(state.expr));
    updateMiniInfo();
  }

  function prettyExpr(expr){
    // show last number nicely with thousands separators (best-effort)
    const parts = expr.split(/([+\-*/()%])/);
    for(let i=0;i<parts.length;i++){
      const p = parts[i];
      if(!p) continue;
      if(/^[0-9.]+$/.test(p) && p !== "."){
        const num = Number(p);
        if(Number.isFinite(num)){
          // keep decimals as typed: if endswith '.', keep
          if(p.endsWith(".")) parts[i] = fmt(num) + ".";
          else parts[i] = fmt(num);
        }
      }
    }
    return parts.join("")
      .replace(/\*/g, "×")
      .replace(/\//g, "÷");
  }

  function backspace(){
    state.expr = state.expr.length <= 1 ? "0" : state.expr.slice(0, -1);
    setScreenText(prettyExpr(state.expr));
    updateMiniInfo();
  }

  function clearAll(){
    state.expr = "0";
    setScreenText("0");
    updateMiniInfo();
  }

  function equals(){
    const n = safeEval(state.expr);
    if(Number.isFinite(n)){
      state.expr = String(n);
      setScreenText(fmt(n));
      updateMiniInfo();
    }else{
      setScreenText("Hata");
      setTimeout(() => {
        setScreenText(prettyExpr(state.expr));
        updateMiniInfo();
      }, 650);
    }
  }

  grid?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if(!btn) return;

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    if(action === "clear") return clearAll();
    if(action === "back") return backspace();
    if(action === "equals") return equals();
    if(value) return pushValue(value);
  });

  document.addEventListener("keydown", (e) => {
    if(state.tab !== "calc") return;

    const k = e.key;
    if(k === "Enter") return equals();
    if(k === "Backspace") return backspace();
    if(k === "Escape") return clearAll();

    if("0123456789".includes(k)) return pushValue(k);
    if(k === ".") return pushValue(".");
    if(["+","-","*","/","%","(",")"].includes(k)) return pushValue(k);
  });

  // ---------- KDV ----------
  const kdvRate = $("kdvRate");
  const kdvOut = $("kdvOut");
  $("netToBrut")?.addEventListener("click", () => {
    const rate = parseNumber(kdvRate?.value || "18") / 100;
    const net = safeEval(state.expr);
    const brut = net * (1 + rate);
    const kdv = brut - net;
    kdvOut.textContent = `Net: ${money(net)} → Brüt: ${money(brut)} (KDV: ${money(kdv)})`;
  });
  $("brutToNet")?.addEventListener("click", () => {
    const rate = parseNumber(kdvRate?.value || "18") / 100;
    const brut = safeEval(state.expr);
    const net = brut / (1 + rate);
    const kdv = brut - net;
    kdvOut.textContent = `Brüt: ${money(brut)} → Net: ${money(net)} (KDV: ${money(kdv)})`;
  });

  // ---------- Percent ----------
  const baseA = $("baseA");
  const percB = $("percB");
  const percOut = $("percOut");

  function getAB(){
    const A = parseNumber(baseA?.value || "");
    const B = parseNumber(percB?.value || "");
    return {A,B};
  }

  $("aOfB")?.addEventListener("click", () => {
    const {A,B} = getAB();
    const res = A * (B/100);
    percOut.textContent = `${fmt(A)}'nın %${fmt(B)}'si = ${money(res)}`;
  });
  $("aPlusB")?.addEventListener("click", () => {
    const {A,B} = getAB();
    const res = A * (1 + B/100);
    percOut.textContent = `${fmt(A)} + %${fmt(B)} = ${money(res)}`;
  });
  $("aMinusB")?.addEventListener("click", () => {
    const {A,B} = getAB();
    const res = A * (1 - B/100);
    percOut.textContent = `${fmt(A)} - %${fmt(B)} = ${money(res)}`;
  });

  // ---------- Profit/Loss ----------
  const cost = $("cost");
  const sell = $("sell");
  const profitOut = $("profitOut");

  $("swap")?.addEventListener("click", () => {
    const a = cost.value; cost.value = sell.value; sell.value = a;
  });

  $("profitCalc")?.addEventListener("click", () => {
    const c = parseNumber(cost?.value || "");
    const s = parseNumber(sell?.value || "");
    const p = s - c;
    const profitPct = c ? (p/c)*100 : NaN;
    const marginPct = s ? (p/s)*100 : NaN;

    profitOut.innerHTML =
      `Kâr/Zarar: <b>${money(p)}</b><br>` +
      `Kâr% (maliyet): <b>${Number.isFinite(profitPct) ? fmt(profitPct) + "%" : "—"}</b><br>` +
      `Marj% (satış): <b>${Number.isFinite(marginPct) ? fmt(marginPct) + "%" : "—"}</b>`;
  });

  // ---------- FX ----------
  const fxRate = $("fxRate");
  const fxAmount = $("fxAmount");
  const fxFrom = $("fxFrom");
  const fxTo = $("fxTo");
  const fxOut = $("fxOut");

  $("fxUseUSDTRY")?.addEventListener("click", () => { if(fxRate) fxRate.value = String(state.fxUSDTRY).replace(".", ","); });
  $("fxUseEURTRY")?.addEventListener("click", () => { if(fxRate) fxRate.value = String(state.fxEURTRY).replace(".", ","); });

  $("fxConvert")?.addEventListener("click", () => {
    const rate = parseNumber(fxRate?.value || "");
    const amt = parseNumber(fxAmount?.value || "");
    const from = fxFrom?.value || "USD";
    const to = fxTo?.value || "TRY";

    if(!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amt)){
      fxOut.textContent = "Kur ve tutarı doğru gir.";
      return;
    }

    // rate assumed: 1 USD/EUR = rate TRY (when converting between TRY and foreign)
    function toTRY(amount, cur){
      if(cur === "TRY") return amount;
      return amount * rate;
    }
    function fromTRY(amountTRY, cur){
      if(cur === "TRY") return amountTRY;
      return amountTRY / rate;
    }

    let res;
    if(from === to) res = amt;
    else if(to === "TRY") res = toTRY(amt, from);
    else if(from === "TRY") res = fromTRY(amt, to);
    else{
      // foreign -> TRY -> foreign
      const t = toTRY(amt, from);
      res = fromTRY(t, to);
    }

    fxOut.textContent = `${fmt(amt)} ${from} → ${fmt(res)} ${to}`;
  });

  // ---------- Export ----------
  const expOut = $("expOut");

  function expRead(){
    const incoterm = $("incoterm")?.value || "FOB";
    const cur = $("expCur")?.value || "USD";

    const goods = parseNumber($("goodsValue")?.value || "0");
    const freight = parseNumber($("freight")?.value || "0");
    const insurance = parseNumber($("insurance")?.value || "0");
    const inland = parseNumber($("inland")?.value || "0");
    const port = parseNumber($("portFees")?.value || "0");
    const commPct = parseNumber($("commissionPct")?.value || "0");

    const qty = parseNumber($("qty")?.value || "0");
    const unitPrice = parseNumber($("unitPrice")?.value || "0");

    const targetPct = parseNumber($("targetProfitPct")?.value || "0");
    const profitBase = $("profitBase")?.value || "FOB";

    return {incoterm, cur, goods, freight, insurance, inland, port, commPct, qty, unitPrice, targetPct, profitBase};
  }

  function expMoney(n, cur){
    if(!Number.isFinite(n)) return "—";
    return `${cur} ${fmt(n)}`;
  }

  $("expCalc")?.addEventListener("click", () => {
    const x = expRead();

    const FOB = x.goods + x.inland + x.port;
    const CFR = FOB + x.freight;
    const CIF = CFR + x.insurance;

    const commBase = x.incoterm === "CIF" ? CIF : (x.incoterm === "CFR" ? CFR : FOB);
    const commission = commBase * (x.commPct/100);

    const total = commBase + commission;

    const perUnit = x.qty > 0 ? total / x.qty : NaN;

    expOut.innerHTML =
      `FOB: <b>${expMoney(FOB, x.cur)}</b><br>` +
      `CFR: <b>${expMoney(CFR, x.cur)}</b> • CIF: <b>${expMoney(CIF, x.cur)}</b><br>` +
      `Komisyon: <b>${expMoney(commission, x.cur)}</b> (baz: ${x.incoterm})<br>` +
      `Toplam (baz+komisyon): <b>${expMoney(total, x.cur)}</b><br>` +
      `Birim maliyet: <b>${Number.isFinite(perUnit) ? expMoney(perUnit, x.cur) : "—"}</b>`;
  });

  $("priceWithProfit")?.addEventListener("click", () => {
    const x = expRead();

    const FOB = x.goods + x.inland + x.port;
    const CFR = FOB + x.freight;
    const CIF = CFR + x.insurance;

    const base = (x.profitBase === "CIF") ? CIF : FOB;
    const target = base * (1 + (x.targetPct/100));

    const perUnit = x.qty > 0 ? target / x.qty : NaN;

    expOut.innerHTML =
      `Hedef satış baz (${x.profitBase}): <b>${expMoney(base, x.cur)}</b><br>` +
      `Hedef kâr: <b>%${fmt(x.targetPct)}</b><br>` +
      `Hedef satış: <b>${expMoney(target, x.cur)}</b><br>` +
      `Birim hedef satış: <b>${Number.isFinite(perUnit) ? expMoney(perUnit, x.cur) : "—"}</b>`;
  });

  // ---------- Raise calculator ----------
  const raiseOut = $("raiseOut");
  $("raiseCalc")?.addEventListener("click", () => {
    const oldS = parseNumber($("oldSalary")?.value || "");
    const newS = parseNumber($("newSalary")?.value || "");

    if(!Number.isFinite(oldS) || oldS <= 0 || !Number.isFinite(newS) || newS <= 0){
      raiseOut.textContent = "Geçerli maaşları gir.";
      return;
    }

    const pct = ((newS - oldS) / oldS) * 100;
    let msg = "🙂 Zam var ama sessiz sevinç";
    if(pct >= 50) msg = "💸 Moris bey iyi misiniz?";
    else if(pct >= 40) msg = "🔥 Personel çıldırdı ofisten çıkmıyor";
    else if(pct >= 30) msg = "😄 Personel mutlu, enflasyon düşünsün";
    else if(pct >= 20) msg = "🫱 Ağanın Eli tutulmaz";

    raiseOut.innerHTML = `Zam Oranı: <b>%${fmt(pct)}</b><br><br>${msg}`;
  });

  // ---------- init ----------
  setScreenText("0");
  updateMiniInfo();
  switchTab("calc");

  // ---------- Service Worker ----------
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
})();
