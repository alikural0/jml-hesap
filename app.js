(() => {
  // ---------- DOM ----------
  const currencySel = document.getElementById("currency");
  const tabsWrap = document.getElementById("tabs");
  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  const tabInk = document.getElementById("tabInk");

  const panels = {
    calc: document.getElementById("panel-calc"),
    kdv: document.getElementById("panel-kdv"),
    pct: document.getElementById("panel-pct"),
    profit: document.getElementById("panel-profit"),
    fx: document.getElementById("panel-fx"),
    export: document.getElementById("panel-export"),
    comments: document.getElementById("panel-comments"),
  };

  function setActiveTab(key){
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    Object.entries(panels).forEach(([k, el]) => el.classList.toggle("active", k === key));
    moveInk();
  }

  function moveInk(){
    const active = document.querySelector(".tab.active");
    if (!active || !tabInk || !tabsWrap) return;
    const r = active.getBoundingClientRect();
    const pr = tabsWrap.getBoundingClientRect();
    tabInk.style.width = Math.max(36, r.width - 18) + "px";
    tabInk.style.transform = `translateX(${(r.left - pr.left) + 9}px)`;
  }

  // More reliable on mobile than click (prevents double-tap delays)
  tabsWrap.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    e.preventDefault();
    setActiveTab(t.dataset.tab);
  });

  requestAnimationFrame(moveInk);
  window.addEventListener("resize", moveInk);

  // ---------- Formatting helpers ----------
  function sym(cur){ return cur==="TRY" ? "₺" : (cur==="USD" ? "$" : "¤"); }
  function loc(cur){ return cur==="TRY" ? "tr-TR" : "en-US"; }
  function fmtMoney(n, cur){
    const formatted = new Intl.NumberFormat(loc(cur), {minimumFractionDigits:0, maximumFractionDigits:2}).format(n);
    return `${sym(cur)} ${formatted}`;
  }

  // Accept "1.234,56" or "1,234.56" or plain
  function parseLooseNumber(s){
    if (s == null) return null;
    s = String(s).trim();
    if (!s) return null;

    s = s.replace(/[₺$€£]/g, "").replace(/\s+/g, "");

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma && hasDot){
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      const decimalIsComma = lastComma > lastDot;
      if (decimalIsComma){
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot){
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function normalize(n){
    if (!Number.isFinite(n)) return null;
    return Number(n.toFixed(12));
  }

  // ---------- Calculator ----------
  const screen = document.getElementById("screen");
  const grid = document.getElementById("grid");
  const miniInfo = document.getElementById("miniInfo");

  let expr = "0";

  function setExpr(v){ expr = v; render(); }
  function isPlainNumberExpression(s){ return /^[0-9.]+$/.test(s); }
  function safeEval(expression){
    if (!/^[0-9+\-*/%.]+$/.test(expression)) throw new Error("bad");
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + expression + ')')();
  }

  function render(){
    if (expr === "Hata"){ screen.value = "Hata"; return; }
    if (isPlainNumberExpression(expr)){
      const n = Number(expr);
      screen.value = Number.isFinite(n) ? fmtMoney(n, currencySel.value) : "Hata";
      return;
    }
    screen.value = expr;
  }

  function append(ch){
    const cur = expr;
    if (cur === "Hata"){ setExpr("0"); return append(ch); }
    if (cur === "0" && /[0-9]/.test(ch)) return setExpr(ch);

    if (/[+\-*/%]$/.test(cur) && /[+\-*/%]/.test(ch)) return setExpr(cur.slice(0,-1) + ch);

    if (ch === "."){
      const part = cur.split(/[+\-*/%]/).pop();
      if (part.includes(".")) return;
    }
    setExpr(cur + ch);
  }

  function backspace(){
    if (expr === "Hata") return setExpr("0");
    if (expr.length <= 1) return setExpr("0");
    setExpr(expr.slice(0,-1));
  }

  function clearAll(){ setExpr("0"); miniInfo.textContent = "—"; }

  function equals(){
    try{
      const res = normalize(safeEval(expr));
      if (res === null) return setExpr("Hata");
      setExpr(String(res));
      miniInfo.textContent = "Sonuç hesaplandı";
    } catch {
      setExpr("Hata");
      miniInfo.textContent = "Geçersiz ifade";
    }
  }

  function handleKey(btn){
    const action = btn.dataset.action;
    const val = btn.dataset.value;
    if (action === "clear") return clearAll();
    if (action === "back") return backspace();
    if (action === "equals") return equals();
    if (val) return append(val);
  }

  grid.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    e.preventDefault();
    handleKey(btn);
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (/[0-9]/.test(k)) return append(k);
    if (["+", "-", "*", "/", "%", "."].includes(k)) return append(k);
    if (k === "Enter" || k === "=") return equals();
    if (k === "Backspace") return backspace();
    if (k === "Escape") return clearAll();
  });

  function screenNumber(){
    if (isPlainNumberExpression(expr)){
      const n = Number(expr);
      return Number.isFinite(n) ? n : null;
    }
    try{
      const res = normalize(safeEval(expr));
      return res;
    } catch {
      return null;
    }
  }

  currencySel.addEventListener("change", render);

  // ---------- KDV ----------
  const kdvRate = document.getElementById("kdvRate");
  const kdvOut = document.getElementById("kdvOut");
  const netToBrutBtn = document.getElementById("netToBrut");
  const brutToNetBtn = document.getElementById("brutToNet");

  function rate(){ return Number(kdvRate.value)/100; }

  netToBrutBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const net = screenNumber();
    if (net === null) return (kdvOut.textContent = "Ekrandaki değer sayı değil.");
    const brut = normalize(net * (1 + rate()));
    const kdvTutar = normalize(brut - net);
    setExpr(String(brut));
    miniInfo.textContent = `KDV ${kdvRate.value}% uygulandı`;
    kdvOut.innerHTML = `<b>Net:</b> ${fmtMoney(net, currencySel.value)} → <b>Brüt:</b> ${fmtMoney(brut, currencySel.value)} • <b>KDV:</b> ${fmtMoney(kdvTutar, currencySel.value)}`;
  });

  brutToNetBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const brut = screenNumber();
    if (brut === null) return (kdvOut.textContent = "Ekrandaki değer sayı değil.");
    const net = normalize(brut / (1 + rate()));
    const kdvTutar = normalize(brut - net);
    setExpr(String(net));
    miniInfo.textContent = `KDV ${kdvRate.value}% ayrıştırıldı`;
    kdvOut.innerHTML = `<b>Brüt:</b> ${fmtMoney(brut, currencySel.value)} → <b>Net:</b> ${fmtMoney(net, currencySel.value)} • <b>KDV:</b> ${fmtMoney(kdvTutar, currencySel.value)}`;
  });

  // ---------- Percent ----------
  const baseA = document.getElementById("baseA");
  const percB = document.getElementById("percB");
  const percOut = document.getElementById("percOut");

  document.getElementById("aOfB").addEventListener("pointerdown", (e)=>{ e.preventDefault(); pctCalc("of"); });
  document.getElementById("aPlusB").addEventListener("pointerdown", (e)=>{ e.preventDefault(); pctCalc("plus"); });
  document.getElementById("aMinusB").addEventListener("pointerdown", (e)=>{ e.preventDefault(); pctCalc("minus"); });

  function pctCalc(kind){
    const A = parseLooseNumber(baseA.value);
    const B = parseLooseNumber(percB.value);
    if (A === null || B === null){
      percOut.textContent = "A ve B'yi sayı olarak gir.";
      return;
    }
    const p = B/100;
    let res;
    if (kind==="of") res = A*p;
    if (kind==="plus") res = A*(1+p);
    if (kind==="minus") res = A*(1-p);
    res = normalize(res);

    setExpr(String(res));
    miniInfo.textContent = "Yüzde hesaplandı";

    const label = kind==="of" ? "A'nın %B'si" : (kind==="plus" ? "A + %B" : "A - %B");
    percOut.innerHTML = `<b>${label}:</b> A=${fmtMoney(A, currencySel.value)}, B=${B}% → <b>${fmtMoney(res, currencySel.value)}</b>`;
  }

  // ---------- Profit/Loss ----------
  const cost = document.getElementById("cost");
  const sell = document.getElementById("sell");
  const profitOut = document.getElementById("profitOut");

  document.getElementById("profitCalc").addEventListener("pointerdown", (e)=>{ e.preventDefault(); profit(); });
  document.getElementById("swap").addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    const tmp = cost.value; cost.value = sell.value; sell.value = tmp;
    profit();
  });

  function profit(){
    const c = parseLooseNumber(cost.value);
    const s = parseLooseNumber(sell.value);
    if (c === null || s === null){
      profitOut.textContent = "Maliyet ve Satış değerlerini sayı olarak gir.";
      return;
    }
    const p = normalize(s - c);
    const profitPct = c===0 ? null : normalize((p/c)*100);
    const marginPct = s===0 ? null : normalize((p/s)*100);

    setExpr(String(p));
    miniInfo.textContent = "Kar/Zarar hesaplandı";
    profitOut.innerHTML = `<b>Kâr:</b> ${fmtMoney(p, currencySel.value)} • <b>Kâr% (maliyet):</b> ${profitPct===null?"—":profitPct+"%"} • <b>Marj% (satış):</b> ${marginPct===null?"—":marginPct+"%"}`;
  }

  // ---------- FX (Manual) ----------
  const fxRate = document.getElementById("fxRate");
  const fxAmount = document.getElementById("fxAmount");
  const fxFrom = document.getElementById("fxFrom");
  const fxTo = document.getElementById("fxTo");
  const fxOut = document.getElementById("fxOut");

  document.getElementById("fxUseUSDTRY").addEventListener("pointerdown", (e)=>{ e.preventDefault(); fxFrom.value="USD"; fxTo.value="TRY"; });
  document.getElementById("fxUseEURTRY").addEventListener("pointerdown", (e)=>{ e.preventDefault(); fxFrom.value="EUR"; fxTo.value="TRY"; });

  document.getElementById("fxConvert").addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    const r = parseLooseNumber(fxRate.value);
    const amt = parseLooseNumber(fxAmount.value);
    if (r === null || r <= 0) return (fxOut.textContent = "Kur geçersiz. Örn: 35,50");
    if (amt === null) return (fxOut.textContent = "Tutar geçersiz.");

    const from = fxFrom.value;
    const to = fxTo.value;

    let result;
    if ((from === "USD" || from === "EUR") && to === "TRY"){
      result = amt * r;
    } else if (from === "TRY" && (to === "USD" || to === "EUR")){
      result = amt / r;
    } else {
      // basit deneme modu
      result = amt;
    }

    result = normalize(result);
    fxOut.innerHTML = `<b>${amt}</b> ${from} ≈ <b>${result.toFixed(4)}</b> ${to}`;
    setExpr(String(result));
    miniInfo.textContent = "Kur çevirildi";
  });

  // ---------- Export ----------
  const incoterm = document.getElementById("incoterm");
  const expCur = document.getElementById("expCur");
  const goodsValue = document.getElementById("goodsValue");
  const freight = document.getElementById("freight");
  const insurance = document.getElementById("insurance");
  const inland = document.getElementById("inland");
  const portFees = document.getElementById("portFees");
  const commissionPct = document.getElementById("commissionPct");
  const qty = document.getElementById("qty");
  const unitPrice = document.getElementById("unitPrice");
  const expOut = document.getElementById("expOut");
  const profitBase = document.getElementById("profitBase");
  const targetProfitPct = document.getElementById("targetProfitPct");

  document.getElementById("expCalc").addEventListener("pointerdown", (e)=>{ e.preventDefault(); exportCost(); });
  document.getElementById("priceWithProfit").addEventListener("pointerdown", (e)=>{ e.preventDefault(); exportTargetSale(); });

  function computeFOB_CFR_CIF(goods, navlun, sig, term){
    let FOB = goods, CFR = goods + navlun, CIF = goods + navlun + sig;
    if (term === "FOB"){
      FOB = goods; CFR = FOB + navlun; CIF = CFR + sig;
    } else if (term === "CFR"){
      CFR = goods; FOB = CFR - navlun; CIF = CFR + sig;
    } else if (term === "CIF"){
      CIF = goods; CFR = CIF - sig; FOB = CFR - navlun;
    } else if (term === "EXW"){
      FOB = goods; CFR = goods + navlun; CIF = CFR + sig;
    }
    return { FOB: normalize(FOB), CFR: normalize(CFR), CIF: normalize(CIF) };
  }

  function readExportInputs(){
    const cur = expCur.value;
    const term = incoterm.value;

    let goods = parseLooseNumber(goodsValue.value);
    const navlun = parseLooseNumber(freight.value) || 0;
    const sig = parseLooseNumber(insurance.value) || 0;

    const inl = parseLooseNumber(inland.value) || 0;
    const port = parseLooseNumber(portFees.value) || 0;
    const commPct = parseLooseNumber(commissionPct.value) || 0;

    const q = parseLooseNumber(qty.value);
    const up = parseLooseNumber(unitPrice.value);

    if (q != null && up != null) goods = q * up;

    return {cur, term, goods, navlun, sig, inl, port, commPct, q};
  }

  function exportCost(){
    const {cur, term, goods, navlun, sig, inl, port, commPct, q} = readExportInputs();
    if (goods == null) return (expOut.textContent = "Mal bedeli (veya miktar + birim fiyat) gir.");

    const totals = computeFOB_CFR_CIF(goods, navlun, sig, term);
    const commissionAmount = normalize(goods * (commPct/100));
    const FOB_cost = normalize(totals.FOB + inl + port + commissionAmount);
    const CIF_cost = normalize(totals.CIF + inl + port + commissionAmount);

    let unit = "";
    if (q != null && q !== 0){
      unit = `<br><b>Birim maliyet:</b> FOB ${normalize(FOB_cost/q).toFixed(4)} ${cur} • CIF ${normalize(CIF_cost/q).toFixed(4)} ${cur}`;
    }

    expOut.innerHTML =
      `<b>${cur}</b> bazında (girdi incoterm: <b>${term}</b>)<br>
       <b>FOB:</b> ${totals.FOB.toFixed(4)} ${cur}<br>
       <b>CFR:</b> ${totals.CFR.toFixed(4)} ${cur}<br>
       <b>CIF:</b> ${totals.CIF.toFixed(4)} ${cur}<br>
       <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:10px 0">
       <b>Masraflar:</b> İç nakliye ${inl.toFixed(4)} • Liman ${port.toFixed(4)} • Komisyon ${commissionAmount.toFixed(4)}<br>
       <b>Toplam Maliyet (FOB baz):</b> ${FOB_cost.toFixed(4)} ${cur}<br>
       <b>Toplam Maliyet (CIF baz):</b> ${CIF_cost.toFixed(4)} ${cur}
       ${unit}`;
  }

  function exportTargetSale(){
    const {cur, term, goods, navlun, sig, inl, port, commPct, q} = readExportInputs();
    const tp = parseLooseNumber(targetProfitPct.value);
    if (goods == null) return (expOut.textContent = "Mal bedeli (veya miktar + birim fiyat) gir.");
    if (tp == null) return (expOut.textContent = "Hedef kâr % gir (örn 12).");

    const totals = computeFOB_CFR_CIF(goods, navlun, sig, term);
    const commissionAmount = normalize(goods * (commPct/100));
    const FOB_cost = normalize(totals.FOB + inl + port + commissionAmount);
    const CIF_cost = normalize(totals.CIF + inl + port + commissionAmount);

    const base = profitBase.value; // FOB / CIF
    const baseCost = (base === "FOB") ? FOB_cost : CIF_cost;

    const sale = normalize(baseCost * (1 + tp/100));
    let unit = "";
    if (q != null && q !== 0) unit = ` • <b>Birim satış:</b> ${normalize(sale/q).toFixed(4)} ${cur}`;

    expOut.innerHTML =
      `<b>Hedef satış fiyatı</b> (${base} baz, kâr%: ${tp})<br>
       <b>Toplam maliyet:</b> ${baseCost.toFixed(4)} ${cur}<br>
       <b>Satış fiyatı:</b> ${sale.toFixed(4)} ${cur}${unit}`;
  }

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }

  // init
  render();
})();
