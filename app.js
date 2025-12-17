(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    tab: "calc",
    currency: "TRY",
    expr: "0",
    fxUSDTRY: 35.50,
    fxEURTRY: 38.50
  };

  // ---------- number helpers ----------
  function isLikelyTR(s){
    return (s.includes(",") && !s.includes(".")) || /,\d{1,2}$/.test(s);
  }
  function parseNumber(raw){
    let s = String(raw ?? "").trim();
    if(!s) return NaN;
    s = s.replace(/\s/g, "");

    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if(lastComma !== -1 && lastDot !== -1){
      if(lastComma > lastDot){
        s = s.replace(/\./g, "").replace(",", ".");
      }else{
        s = s.replace(/,/g, "");
      }
      return Number(s);
    }

    if(isLikelyTR(s)){
      s = s.replace(/\./g, "").replace(",", ".");
      return Number(s);
    }
    s = s.replace(/,/g, "");
    return Number(s);
  }

  function fmt(n){
    if(!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
  }

  function money(n){
    const sym = state.currency === "USD" ? "$" : "₺";
    return `${sym} ${fmt(n)}`;
  }

  // ---------- tabs ----------
  function switchTab(tab){
    state.tab = tab;

    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    const panel = $(`panel-${tab}`);
    if(panel) panel.classList.add("active");

    // menu highlight
    const menu = $("menu");
    menu?.querySelectorAll("button[data-tab]")?.forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

  // ---------- menu (KESİN ÇALIŞIR) ----------
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

  menuBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if(menu.classList.contains("open")) closeMenu();
    else openMenu();
  });

  menuBackdrop?.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeMenu();
  });

  menu?.querySelectorAll("button[data-tab]")?.forEach(btn => {
    btn.addEventListener("click", () => {
      closeMenu();
      switchTab(btn.dataset.tab);
    });
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

  function safeEval(expr){
    try{
      const s = expr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/[^\d+\-*/().%]/g, "");
      if(!s) return NaN;
      // eslint-disable-next-line no-new-func
      return Number(Function(`"use strict"; return (${s});`)());
    }catch{
      return NaN;
    }
  }

  function prettyExpr(expr){
    const parts = expr.split(/([+\-*/()%])/);
    for(let i=0;i<parts.length;i++){
      const p = parts[i];
      if(/^[0-9.]+$/.test(p) && p !== "."){
        const num = Number(p);
        if(Number.isFinite(num)){
          parts[i] = p.endsWith(".") ? (fmt(num) + ".") : fmt(num);
        }
      }
    }
    return parts.join("").replace(/\*/g,"×").replace(/\//g,"÷");
  }

  function setScreen(text){
    if(screen) screen.value = text;
  }

  function updateMiniInfo(){
    if(!miniInfo) return;
    const n = safeEval(state.expr);
    miniInfo.textContent = Number.isFinite(n) ? money(n) : "—";
  }

  function pushValue(v){
    if(state.expr === "0" && /[0-9.]/.test(v)) state.expr = (v === ".") ? "0." : v;
    else state.expr += v;
    setScreen(prettyExpr(state.expr));
    updateMiniInfo();
  }

  function backspace(){
    state.expr = state.expr.length <= 1 ? "0" : state.expr.slice(0,-1);
    setScreen(prettyExpr(state.expr));
    updateMiniInfo();
  }

  function clearAll(){
    state.expr = "0";
    setScreen("0");
    updateMiniInfo();
  }

  function equals(){
    const n = safeEval(state.expr);
    if(Number.isFinite(n)){
      state.expr = String(n);
      setScreen(fmt(n));
      updateMiniInfo();
    }else{
      setScreen("Hata");
      setTimeout(() => {
        setScreen(prettyExpr(state.expr));
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
    percOut.textContent = `${fmt(A)}'nın %${fmt(B)}'si = ${money(A*(B/100))}`;
  });

  $("aPlusB")?.addEventListener("click", () => {
    const {A,B} = getAB();
    percOut.textContent = `${fmt(A)} + %${fmt(B)} = ${money(A*(1+B/100))}`;
  });

  $("aMinusB")?.addEventListener("click", () => {
    const {A,B} = getAB();
    percOut.textContent = `${fmt(A)} - %${fmt(B)} = ${money(A*(1-B/100))}`;
  });

  // ---------- Profit/Loss ----------
  const cost = $("cost");
  const sell = $("sell");
  const profitOut = $("profitOut");

  $("swap")?.addEventListener("click", () => {
    const a = cost.value;
    cost.value = sell.value;
    sell.value = a;
  });

  $("profitCalc")?.addEventListener("click", () => {
    const c = parseNumber(cost?.value || "");
    const s = parseNumber(sell?.value || "");
    const p = s - c;
    const profitPct = c ? (p/c)*100 : NaN;
    const marginPct = s ? (p/s)*100 : NaN;

    profitOut.innerHTML =
      `Kâr/Zarar: <b>${money(p)}</b><br>` +
      `Kâr% (maliyet): <b>${Number.isFinite(profitPct) ? fmt(profitPct)+"%" : "—"}</b><br>` +
      `Marj% (satış): <b>${Number.isFinite(marginPct) ? fmt(marginPct)+"%" : "—"}</b>`;
  });

  // ---------- FX ----------
  const fxRate = $("fxRate");
  const fxAmount = $("fxAmount");
  const fxFrom = $("fxFrom");
  const fxTo = $("fxTo");
  const fxOut = $("fxOut");

  $("fxUseUSDTRY")?.addEventListener("click", () => { fxRate.value = String(state.fxUSDTRY).replace(".", ","); });
  $("fxUseEURTRY")?.addEventListener("click", () => { fxRate.value = String(state.fxEURTRY).replace(".", ","); });

  $("fxConvert")?.addEventListener("click", () => {
    const rate = parseNumber(fxRate?.value || "");
    const amt = parseNumber(fxAmount?.value || "");
    const from = fxFrom?.value || "USD";
    const to = fxTo?.value || "TRY";

    if(!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(amt)){
      fxOut.textContent = "Kur ve tutarı doğru gir.";
      return;
    }

    const toTRY = (a, c) => c === "TRY" ? a : a * rate;
    const fromTRY = (a, c) => c === "TRY" ? a : a / rate;

    let res;
    if(from === to) res = amt;
    else if(to === "TRY") res = toTRY(amt, from);
    else if(from === "TRY") res = fromTRY(amt, to);
    else res = fromTRY(toTRY(amt, from), to);

    fxOut.textContent = `${fmt(amt)} ${from} → ${fmt(res)} ${to}`;
  });

  // ---------- Export ----------
  function expRead(){
    return {
      incoterm: $("incoterm")?.value || "FOB",
      cur: $("expCur")?.value || "USD",
      goods: parseNumber($("goodsValue")?.value || "0"),
      freight: parseNumber($("freight")?.value || "0"),
      insurance: parseNumber($("insurance")?.value || "0"),
      inland: parseNumber($("inland")?.value || "0"),
      port: parseNumber($("portFees")?.value || "0"),
      commPct: parseNumber($("commissionPct")?.value || "0"),
      qty: parseNumber($("qty")?.value || "0"),
      targetPct: parseNumber($("targetProfitPct")?.value || "0"),
      profitBase: $("profitBase")?.value || "FOB",
    };
  }
  const expOut = $("expOut");
  const expMoney = (n, cur) => Number.isFinite(n) ? `${cur} ${fmt(n)}` : "—";

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
      `Toplam: <b>${expMoney(total, x.cur)}</b><br>` +
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

  // ---------- Raise ----------
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
  switchTab("calc");
  setScreen("0");
  updateMiniInfo();

  // ---------- Service Worker ----------
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
})();
