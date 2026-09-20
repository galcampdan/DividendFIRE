
const UI_VERSION='v2.0.5';
const MODERN_BUILD='2026-09-20-v2.0.5-tooltip-layout-1';
const LEGACY_APP_VERSION='v8.9.3';
const LEGACY_BUILD='2026-09-19-v8.9.3-nominal-real-hover-1';
async function verifyBuild(){
  const proof=$('#buildProof');
  try{
    const r=await fetch('/api/version?ts='+Date.now(),{cache:'no-store'});
    const j=await r.json();
    const modern=!!(j.web||j.platform==='web'||j.platform==='tauri');
    const ok=modern
      ? (j.version===UI_VERSION&&j.build===MODERN_BUILD)
      : (j.version===LEGACY_APP_VERSION&&j.build===LEGACY_BUILD);
    if(!r.ok||!ok){
      if(proof){proof.textContent=`⚠ 빌드 불일치: UI ${UI_VERSION} / runtime ${j.version||'?'} ${j.build||''}`;proof.classList.add('bad');}
      throw new Error('앱 파일 버전이 서로 다릅니다. 새로고침하거나 최신 버전을 사용하세요.');
    }
    if(proof){proof.textContent=modern?'✓ v2.0.5 · SHARED CORE VERIFIED':'✓ LEGACY v8.9.3 VERIFIED';proof.classList.add('ok');}
    return true;
  }catch(e){
    if(proof&&!proof.classList.contains('bad')){proof.textContent='⚠ 실행 환경 확인 실패: '+e.message;proof.classList.add('bad');}
    throw e;
  }
}
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const pf = $('#portfolio');
const SETTINGS_KEY = 'DividendFireMVP.settings.v2';
const LEGACY_SETTINGS_KEY = 'DividendFireMVP.settings.v1';
let portfolio = [
  { ticker: 'SCHD', weight: 69, priceGrowth: 4.0, distributionGrowth: 6.0 },
  { ticker: 'JEPQ', weight: 31, priceGrowth: 2.5, distributionGrowth: 2.0 },
];
let saveTimer = null;
let contributionSchedule = {}; // {calendarYear: monthlyContributionManwon}; restored with settings
let showAllContributionYears = false;
let scrollResultsAfterRun = false;
const mobileQuery = window.matchMedia('(max-width: 700px)');
function isMobileUI(){ return mobileQuery.matches; }
function updateFoldSummaries(){
  const annual=$('#annualSummary');
  if(annual){
    const n=Object.keys(contributionSchedule).length,base=Number($('#contrib')?.value)||0;
    annual.textContent=n?`기본 ${base.toLocaleString('ko-KR')}만 · 예외 ${n}개`:`기본 ${base.toLocaleString('ko-KR')}만/월`;
  }
  const fire=$('#fireSummary');
  if(fire){
    fire.textContent=`${fireMode()==='withdrawal'?'n% 인출':'배당생활'} · 생활비 ${Number($('#fireexp')?.value||0).toLocaleString('ko-KR')}만 · 물가 ${Number($('#inflation')?.value||0).toFixed(1)}%`;
  }
  const pfSummary=$('#portfolioSummary');
  if(pfSummary){
    pfSummary.textContent=portfolio.slice(0,3).map(x=>`${x.ticker} ${Number(x.weight||0).toFixed(0)}%`).join(' · ')+(portfolio.length>3?` 외 ${portfolio.length-3}`:'');
  }
}
function syncResponsiveFolds(initial=false){
  const ids=['annualDetails','fireDetails','portfolioDetails'];
  if(!isMobileUI()){
    ids.forEach(id=>{const d=$('#'+id);if(d)d.open=true;});
  }else if(initial){
    ids.forEach(id=>{const d=$('#'+id);if(d)d.open=false;});
  }
}
mobileQuery.addEventListener?.('change',()=>{showAllContributionYears=false;syncResponsiveFolds(true);renderContributionSchedule();});



function settingsSnapshot(){
  const ids=['age','initial','income','salaryGrowth','contrib','fireexp','health','postFireIncome','otherincome','inflation','years','withdrawalRate','stress'];
  const fields={}; ids.forEach(id=>{ const el=$('#'+id); if(el) fields[id]=el.value; });
  return {fields,fireMode:fireMode(),reinvest:$('#reinvest')?.checked!==false,cashflowEnabled:$('#cashflowEnabled')?.checked===true,portfolio:portfolio.map(x=>({...x})),contributionSchedule:{...contributionSchedule}};
}
function applySettings(v){
  if(!v || typeof v!=='object') return false;
  if(v.fields) Object.entries(v.fields).forEach(([id,val])=>{const el=$('#'+id);if(el&&val!==undefined&&val!==null)el.value=val;});
  if(v.fireMode){const r=document.querySelector(`input[name="fireMode"][value="${v.fireMode}"]`);if(r)r.checked=true;}
  if(typeof v.reinvest==='boolean'&&$('#reinvest')) $('#reinvest').checked=v.reinvest;
  if(typeof v.cashflowEnabled==='boolean'&&$('#cashflowEnabled')) $('#cashflowEnabled').checked=v.cashflowEnabled;
  if(Array.isArray(v.portfolio)&&v.portfolio.length){
    portfolio=v.portfolio.map(x=>({ticker:sanitizeTicker(x.ticker),weight:+x.weight||0,priceGrowth:+x.priceGrowth||0,distributionGrowth:+x.distributionGrowth||0})).filter(x=>x.ticker);
    rebalanceAfterDelete();
  }
  contributionSchedule={};
  if(v.contributionSchedule && typeof v.contributionSchedule==='object'){
    Object.entries(v.contributionSchedule).forEach(([year,val])=>{
      const y=parseInt(year,10), n=Number(val);
      if(Number.isFinite(y)&&y>=1900&&y<=2300&&Number.isFinite(n)&&n>=0) contributionSchedule[String(y)]=n;
    });
  }
  return true;
}
function saveLocal(snapshot){
  try{ localStorage.setItem(SETTINGS_KEY,JSON.stringify(snapshot)); }catch(_){}
}
function restoreLocal(){
  try{
    const raw=localStorage.getItem(SETTINGS_KEY)||localStorage.getItem(LEGACY_SETTINGS_KEY);
    return raw?applySettings(JSON.parse(raw)):false;
  }catch(_){return false;}
}

async function loadSettings(){
  try{
    const r=await fetch('/api/settings',{cache:'no-store'});
    const j=await r.json();
    if(r.ok && j.settings && Object.keys(j.settings).length) return applySettings(j.settings);
  }catch(_){}
  return restoreLocal();
}
function setSaveStatus(text,kind=''){
  const el=$('#saveStatus'); if(!el)return; el.textContent=text; el.className='save-status '+kind;
}
function scheduleSave(){
  const snapshot=settingsSnapshot();
  saveLocal(snapshot);
  setSaveStatus('저장 중…','saving');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{
      const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),cache:'no-store'});
      if(!r.ok) throw new Error('save failed');
      setSaveStatus('저장됨','saved');
    }catch(_){ setSaveStatus('브라우저에만 저장됨','warn'); }
  },220);
}
function bindAutoSave(){
  document.querySelectorAll('input,select').forEach(el=>{el.addEventListener('input',scheduleSave);el.addEventListener('change',scheduleSave);});
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, Number(n) || 0)); }
function manwon(n) { const v=(Number(n)||0)/10000; return v.toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원'; }
function manwonInput(n) { return (Number(n)||0)*10000; }
function pct01(n) { return ((Number(n)||0)*100).toFixed(2)+'%'; }
function pct100(n) { return (Number(n)||0).toFixed(1)+'%'; }
function usd(n) { return '$'+(Number(n)||0).toLocaleString('en-US',{maximumFractionDigits:2}); }
function sanitizeTicker(t){return String(t||'').trim().toUpperCase().replace(/[^A-Z0-9.^=\-]/g,'');}
function fireMode(){return $('input[name="fireMode"]:checked')?.value||'withdrawal';}

function normalizeWeights(changedIndex,newWeight){
  const n=portfolio.length;if(!n)return;if(n===1){portfolio[0].weight=100;return;}
  const target=clamp(newWeight,0,100);const oldOthers=portfolio.reduce((s,x,i)=>s+(i===changedIndex?0:x.weight),0);const remain=100-target;
  portfolio[changedIndex].weight=target;
  if(oldOthers<=0){const each=remain/(n-1);portfolio.forEach((x,i)=>{if(i!==changedIndex)x.weight=each;});}
  else portfolio.forEach((x,i)=>{if(i!==changedIndex)x.weight=x.weight/oldOthers*remain;});
  const sum=portfolio.reduce((a,x)=>a+x.weight,0);const ci=portfolio.findIndex((_,i)=>i!==changedIndex);if(ci>=0)portfolio[ci].weight+=100-sum;
}
function rebalanceAfterDelete(){if(!portfolio.length)return;const s=portfolio.reduce((a,x)=>a+x.weight,0);if(s<=0){const e=100/portfolio.length;portfolio.forEach(x=>x.weight=e);}else portfolio.forEach(x=>x.weight=x.weight/s*100);}
function syncWeightControls(){
  $$('.portfolio-row').forEach((row,i)=>{const item=portfolio[i];if(!item)return;const range=row.querySelector('.weight-range');const num=row.querySelector('.weight-number');const v=item.weight.toFixed(1);if(range&&document.activeElement!==range)range.value=v;if(num&&document.activeElement!==num)num.value=v;});
  $('#weightTotal').textContent=pct100(portfolio.reduce((a,x)=>a+x.weight,0));
}
function renderPF(){
  pf.innerHTML='';
  portfolio.forEach((item,i)=>{
    const row=document.createElement('div');row.className='portfolio-row';
    row.innerHTML=`<b>${item.ticker}</b>
      <input class="weight-range" type="range" min="0" max="100" step="0.5" value="${item.weight.toFixed(1)}" aria-label="${item.ticker} 비중">
      <div class="weight-box"><input class="weight-number" type="number" min="0" max="100" step="0.5" value="${item.weight.toFixed(1)}"><span>%</span></div>
      <button class="remove" type="button" aria-label="${item.ticker} 제거">×</button>
      <div class="growth-assumptions">
        <label><span>가격 성장</span><div><input class="price-growth" type="number" min="-50" max="50" step="0.1" value="${Number(item.priceGrowth??4).toFixed(1)}"><em>%/년</em></div></label>
        <label><span>분배금 성장</span><div><input class="dist-growth" type="number" min="-50" max="50" step="0.1" value="${Number(item.distributionGrowth??2).toFixed(1)}"><em>%/년</em></div></label>
      </div>`;
    const range=row.querySelector('.weight-range'),num=row.querySelector('.weight-number');
    range.addEventListener('input',()=>{normalizeWeights(i,range.value);num.value=portfolio[i].weight.toFixed(1);syncWeightControls();scheduleSave();});
    num.addEventListener('input',()=>{normalizeWeights(i,num.value);range.value=portfolio[i].weight.toFixed(1);syncWeightControls();scheduleSave();});
    row.querySelector('.price-growth').addEventListener('input',e=>{portfolio[i].priceGrowth=clamp(e.target.value,-50,50);scheduleSave();});
    row.querySelector('.dist-growth').addEventListener('input',e=>{portfolio[i].distributionGrowth=clamp(e.target.value,-50,50);scheduleSave();});
    row.querySelector('.remove').addEventListener('click',()=>{if(portfolio.length<=1)return;portfolio.splice(i,1);rebalanceAfterDelete();renderPF();scheduleSave();});
    pf.appendChild(row);
  });syncWeightControls();updateFoldSummaries();
}
async function addTicker(){
  const input=$('#newTicker'),ticker=sanitizeTicker(input.value),status=$('#tickerStatus');if(!ticker)return;
  if(portfolio.some(x=>x.ticker===ticker)){status.textContent=`${ticker}는 이미 들어 있습니다.`;status.className='hint bad';return;}
  $('#addTicker').disabled=true;status.textContent=`${ticker} 확인 중...`;status.className='hint';
  try{const r=await fetch(`/api/ticker?ticker=${encodeURIComponent(ticker)}`,{cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'티커 확인 실패');portfolio.forEach(x=>x.weight*=0.9);portfolio.push({ticker,weight:10,priceGrowth:Number(j.default_price_growth||0.04)*100,distributionGrowth:Number(j.default_distribution_growth||0.02)*100});input.value='';status.textContent=`${ticker} 추가됨 · ${j.source.includes('DEMO')?'DEMO 데이터':'LIVE 확인'}`;renderPF();scheduleSave();}catch(e){status.textContent=e.message;status.className='hint bad';}finally{$('#addTicker').disabled=false;}
}
$('#addTicker').addEventListener('click',addTicker);$('#newTicker').addEventListener('keydown',e=>{if(e.key==='Enter')addTicker();});


function simulationStartYear(){ return new Date().getFullYear(); }
function simulationYears(){ return Math.max(1,Math.min(60,parseInt($('#years')?.value||40,10)||40)); }
function currentContributionManwonForYear(year){
  const key=String(year);
  return Object.prototype.hasOwnProperty.call(contributionSchedule,key) ? Number(contributionSchedule[key])||0 : Number($('#contrib')?.value)||0;
}
function renderContributionSchedule(){
  const box=$('#contributionSchedule'); if(!box)return;
  const start=simulationStartYear(), count=simulationYears(), base=Number($('#contrib')?.value)||0;
  const validYears=new Set(Array.from({length:count},(_,i)=>String(start+i)));
  Object.keys(contributionSchedule).forEach(y=>{if(!validYears.has(y)) delete contributionSchedule[y];});
  box.innerHTML='';
  const visibleCount=isMobileUI()&&!showAllContributionYears?Math.min(10,count):count;
  const frag=document.createDocumentFragment();
  for(let i=0;i<visibleCount;i++){
    const year=start+i, key=String(year), row=document.createElement('label');
    row.className='annual-contrib-row';
    const has=Object.prototype.hasOwnProperty.call(contributionSchedule,key);
    row.innerHTML=`<span>${year}년</span><div class="input-unit"><input class="annual-contrib-input" data-year="${year}" type="number" inputmode="decimal" min="0" step="10" value="${has?contributionSchedule[key]:''}" placeholder="${base}"><em>만원/월</em></div>`;
    const input=row.querySelector('input');
    input.addEventListener('input',()=>{
      const raw=input.value.trim();
      if(raw==='') delete contributionSchedule[key];
      else contributionSchedule[key]=Math.max(0,Number(raw)||0);
      updateCashflowHint();updateFoldSummaries();scheduleSave();
    });
    frag.appendChild(row);
  }
  box.appendChild(frag);
  const more=$('#showMoreContributionYears');
  if(more){
    const hidden=count-visibleCount;
    more.hidden=hidden<=0;
    more.textContent=hidden>0?`향후 ${hidden}개 연도 더 보기`:'';
  }
  updateFoldSummaries();
}
function annualContributionPayload(){
  const out={};
  Object.entries(contributionSchedule).forEach(([year,val])=>{out[year]=manwonInput(val);});
  return out;
}

function payload(){
  const now=new Date();
  return{
    currentAge:clamp($('#age').value,0,100),startYear:now.getFullYear(),startMonth:now.getMonth()+1,
    initialCapital:manwonInput($('#initial').value),monthlyIncome:manwonInput($('#income').value),salaryGrowth:+$('#salaryGrowth').value,fixedExpenses:0,monthlyContribution:manwonInput($('#contrib').value),contributionSchedule:annualContributionPayload(),cashflowEnabled:$('#cashflowEnabled')?.checked===true,
    fireExpenses:manwonInput($('#fireexp').value),healthInsurance:manwonInput($('#health').value),postFireIncome:manwonInput($('#postFireIncome').value),otherAnnualIncome:manwonInput($('#otherincome').value),
    inflation:+$('#inflation').value,years:+$('#years').value,dividendStress:+$('#stress').value,withdrawalRate:+$('#withdrawalRate').value,fireMode:fireMode(),reinvest:$('#reinvest').checked,
    portfolio:portfolio.map(x=>({ticker:x.ticker,weight:x.weight,priceGrowth:x.priceGrowth,distributionGrowth:x.distributionGrowth}))
  };
}
function updateModeUI(){
  const withdrawal=fireMode()==='withdrawal';$('#withdrawalRateField').classList.toggle('mode-hidden',!withdrawal);$('#dividendStressField').classList.toggle('mode-hidden',withdrawal);
  $('#fireLabel').textContent=withdrawal?'n% Withdrawal FIRE':'Dividend FIRE';
  $('#fireSub').textContent=withdrawal?'세후 n% 인출가능액이 물가반영 필요생활비를 넘는 시점':'원금 매도 없이 세후 배당이 필요생활비를 넘는 시점';
  $('#currentCashLabel').textContent=withdrawal?'현재 세후 월 인출가능액':'현재 세후 월배당';$('#finalCashLabel').textContent=withdrawal?'최종 세후 월 인출가능액':'최종 세후 월배당';
  $('#cashChartTitle').textContent=withdrawal?'인출 여력 vs 필요 생활비':'배당 구매력 vs 필요 생활비';
  $('#cashChartDesc').textContent=withdrawal?'FIRE 이후에는 배당을 먼저 쓰고 부족한 생활비만 자산을 매도합니다.':'FIRE 이후에는 적립을 멈추고 배당으로 생활하며, 초과분만 재투자합니다.';
  $('#modeHelp').textContent=withdrawal?`연 ${(+$('#withdrawalRate').value||0).toFixed(1)}% 인출 한도로 FIRE 여부를 판단합니다.`:'초기 분배율뿐 아니라 분배금 성장률이 물가를 따라가는지도 함께 봅니다.';
  updateCashflowVisibility();updateFoldSummaries();
}
function cashflowEnabled(){return $('#cashflowEnabled')?.checked===true;}
function updateCashflowVisibility(){
  const on=cashflowEnabled(),panel=$('#cashflowPanel');
  if(panel)panel.classList.toggle('cashflow-hidden',!on);
  if(on)$('#currentCashLabel').textContent='현재 월 총 현금유입';
  else $('#currentCashLabel').textContent=fireMode()==='withdrawal'?'현재 세후 월 인출가능액':'현재 세후 월배당';
}
function renderCashflow(j){
  updateCashflowVisibility();
  if(!cashflowEnabled())return;
  const pairs=[
    ['#cfIncome',j.cashflowIncome],['#cfDividend',j.cashflowDividend],['#cfTotal',j.cashflowTotalInflow],
    ['#cfLiving',j.cashflowLivingCost],['#cfContribution',j.cashflowContribution],['#cfReinvest',j.cashflowDividendReinvest],['#cfRemaining',j.cashflowRemaining]
  ];
  pairs.forEach(([id,v])=>{const el=$(id);if(el)el.textContent=manwon(v)+'/월';});
  const formula=$('#cashflowFormula');
  if(formula)formula.textContent=`${manwon(j.cashflowIncome)} + ${manwon(j.cashflowDividend)} = ${manwon(j.cashflowTotalInflow)}/월`;
  const rem=$('#cfRemaining');if(rem)rem.classList.toggle('negative',Number(j.cashflowRemaining)<0);
}
$$('input[name="fireMode"]').forEach(el=>el.addEventListener('change',updateModeUI));$('#withdrawalRate').addEventListener('input',updateModeUI);
$('#cashflowEnabled').addEventListener('change',()=>{updateCashflowVisibility();scheduleSave();runSimulation();});
function updateCashflowHint(){
  const income=+$('#income').value||0,growth=+$('#salaryGrowth').value||0,living=+$('#fireexp').value||0,year=simulationStartYear();
  const contrib=currentContributionManwonForYear(year),base=income-living-contrib,el=$('#cashflowHint');
  if(base<0){el.textContent=`⚠ ${year}년 기준 소득에서 생활비·납입을 빼면 ${manwon(manwonInput(-base))} 부족합니다. Cashflow를 켜면 배당까지 포함한 상세 흐름을 볼 수 있습니다.`;el.className='hint bad';}
  else{el.textContent=`${year}년 초봉 기준 월급 - 생활비 - 납입 = ${manwon(manwonInput(base))}/월 · 연봉은 매 12개월마다 ${growth>=0?'+':''}${growth.toFixed(1)}% 복리 반영됩니다.`;el.className='hint';}
}
['income','salaryGrowth','fireexp'].forEach(id=>$('#'+id).addEventListener('input',()=>{updateCashflowHint();updateFoldSummaries();}));
$('#contrib').addEventListener('input',()=>{renderContributionSchedule();updateCashflowHint();updateFoldSummaries();});
$('#years').addEventListener('change',()=>{renderContributionSchedule();scheduleSave();});
$('#years').addEventListener('input',()=>{showAllContributionYears=false;renderContributionSchedule();});
$('#resetContributionSchedule').addEventListener('click',()=>{contributionSchedule={};showAllContributionYears=false;renderContributionSchedule();updateCashflowHint();scheduleSave();});
$('#showMoreContributionYears')?.addEventListener('click',()=>{showAllContributionYears=true;renderContributionSchedule();});

function niceMax(max){if(!isFinite(max)||max<=0)return 1;const exp=Math.pow(10,Math.floor(Math.log10(max))),m=max/exp;return(m<=1?1:m<=2?2:m<=5?5:10)*exp;}
function compactKRW(v){const man=(Number(v)||0)/10000;return man.toLocaleString('ko-KR',{maximumFractionDigits:man<100?1:0})+'만원';}
function currentValueKRW(v,row){const yrs=Math.max(0,Number(row?.year)||0);const inf=clamp($('#inflation')?.value,-2,15)/100;const factor=Math.pow(1+inf,yrs);return factor>0?(Number(v)||0)/factor:(Number(v)||0);}
function nominalRealHTML(label,value,row,suffix=''){const real=currentValueKRW(value,row);return `<div class="nominal-real-row"><span>${label}</span><b>명목 ${compactKRW(value)}${suffix}</b><small>현재가치 ${compactKRW(real)}${suffix}</small></div>`;}
function ageText(age){const a=Number(age)||0;return (Math.abs(a-Math.round(a))<0.05?Math.round(a).toString():a.toFixed(1))+'세';}
function calendarText(row,withMonth=true){if(!row)return '-';const y=Number(row.calendarYear)||0,m=Number(row.calendarMonth)||1;return withMonth?`${y}년 ${m}월 · ${ageText(row.age)}`:`${y}년 · ${ageText(row.age)}`;}
function milestoneText(month,j){if(month==null)return null;const total=(Number(j.startMonth||1)-1)+Number(month);const y=Number(j.startYear||new Date().getFullYear())+Math.floor(total/12);const m=(total%12)+1;const age=Number(j.currentAge||0)+Number(month)/12;return {year:y,month:m,age,main:`${y}년 · ${ageText(age)}`,sub:`${m}월 · ${(Number(month)/12).toFixed(1)}년 후`};}
function nearestRowIndex(rows,targetYear){let bi=0,d=Infinity;for(let i=0;i<rows.length;i++){const nd=Math.abs((Number(rows[i].year)||0)-targetYear);if(nd<d){d=nd;bi=i;}}return bi;}
function nearestRow(rows,targetYear){return rows[nearestRowIndex(rows,targetYear)];}
function drawChart(container,rows,series,fireMonth=null,cashMode='withdrawal',showCashflow=false){
  if(typeof container._chartCleanup==='function'){try{container._chartCleanup();}catch(_){}}
  const mobile=isMobileUI();
  const W=mobile?360:900,H=mobile?270:326,pad=mobile?{l:54,r:12,t:46,b:48}:{l:78,r:24,t:38,b:58},plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  const values=rows.flatMap(r=>series.map(s=>Number(r[s.key])||0));
  const ymax=niceMax(Math.max(...values,1)),xmax=Math.max(1,Number(rows.at(-1)?.year)||1);
  const x=yr=>pad.l+(yr/xmax)*plotW,y=val=>pad.t+plotH-(val/ymax)*plotH;
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="시뮬레이션 그래프">`;
  for(let i=0;i<=4;i++){
    const val=ymax*i/4,yy=y(val);
    svg+=`<line class="gridline" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text class="axis" x="${pad.l-9}" y="${yy+4}" text-anchor="end">${compactKRW(val)}</text>`;
  }
  (mobile?[0,.5,1]:[0,.25,.5,.75,1]).forEach(f=>{
    const target=xmax*f,r=nearestRow(rows,target),xx=x(Number(r.year)||0);
    svg+=`<text class="axis axis-time" x="${xx}" y="${H-28}" text-anchor="middle"><tspan x="${xx}" dy="0">${r.calendarYear}년</tspan><tspan x="${xx}" dy="13">${ageText(r.age)}</tspan></text>`;
  });
  series.forEach((s,si)=>{
    const cls=['series-a','series-b','series-c'][si]||'series-c';
    const points=rows.map(r=>`${x(Number(r.year)||0).toFixed(1)},${y(Number(r[s.key])||0).toFixed(1)}`).join(' ');
    svg+=`<polyline class="${cls}" points="${points}"/>`;
    const lx=pad.l+si*(mobile?145:190);
    svg+=`<line class="${cls}" x1="${lx}" y1="16" x2="${lx+22}" y2="16"/><text class="legend" x="${lx+28}" y="20">${s.label}</text>`;
  });
  if(fireMonth!=null&&fireMonth/12<=xmax){
    const fx=x(fireMonth/12);
    svg+=`<line class="fire-line" x1="${fx}" y1="${pad.t}" x2="${fx}" y2="${pad.t+plotH}"/><text class="fire-text" x="${Math.min(fx+5,W-95)}" y="${pad.t+12}">🔥 FIRE</text>`;
  }
  svg+=`<line class="hover-line" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+plotH}" visibility="hidden"/><g class="hover-dots" visibility="hidden">${series.map((_,i)=>`<circle class="hover-dot dot-${i}" r="4.5" cx="${pad.l}" cy="${pad.t}"/>`).join('')}</g></svg>`;

  container.innerHTML=`<div class="chart-stage">${svg}<div class="chart-tooltip" aria-live="polite"></div></div><div class="chart-readout">그래프 위에 마우스를 움직이면 해당 연도·나이·금액이 표시됩니다.</div>`;

  const stage=container.querySelector('.chart-stage');
  const svgEl=stage.querySelector('svg');
  const tip=stage.querySelector('.chart-tooltip');
  const hover=svgEl.querySelector('.hover-line');
  const dots=Array.from(svgEl.querySelectorAll('.hover-dot'));
  const dotGroup=svgEl.querySelector('.hover-dots');
  const readout=container.querySelector('.chart-readout');
  let pinned=false,currentIndex=0,touching=false,lastTouchIndex=null,lastTouchAt=0,lastHapticAt=0,ignoreMouseUntil=0;
  const mobileInstruction='그래프를 손가락으로 문지르면 해당 시점이 표시됩니다. 손을 떼면 사라집니다.';

  function resetMobileReadout(){
    if(!mobile)return;
    readout.textContent=mobileInstruction;
    readout.classList.remove('active');
  }
  function hide(force=false){
    if(pinned&&!force)return;
    tip.classList.remove('visible','pinned');
    hover.setAttribute('visibility','hidden');
    dotGroup.setAttribute('visibility','hidden');
    if(force)resetMobileReadout();
  }
  function hapticTick(){
    if(!mobile||typeof navigator.vibrate!=='function')return;
    const now=performance.now();
    if(now-lastHapticAt<18)return;
    lastHapticAt=now;
    try{navigator.vibrate(7);}catch(_){}
  }

  function renderRow(r,idx,clientX=null,clientY=null,showTip=true){
    if(!r)return;
    currentIndex=idx;
    const stageRect=stage.getBoundingClientRect();
    const svgRect=svgEl.getBoundingClientRect();
    if(!stageRect.width||!stageRect.height||!svgRect.width)return;
    const vx=x(Number(r.year)||0);
    hover.setAttribute('x1',vx);hover.setAttribute('x2',vx);hover.setAttribute('visibility','visible');
    dots.forEach((d,i)=>{d.setAttribute('cx',vx);d.setAttribute('cy',y(Number(r[series[i].key])||0));});
    dotGroup.setAttribute('visibility','visible');
    const isWithdrawal=cashMode==='withdrawal';
    const netMonthly=isWithdrawal?(Number(r.netWithdrawal)||0):(Number(r.netDividend)||0);
    const grossMonthly=isWithdrawal?(Number(r.grossWithdrawal)||0):(Number(r.grossDividend)||0);
    const monthlyLabel=isWithdrawal?'세후 월 인출 가능액':'세후 월 배당금';
    const realNetMonthly=currentValueKRW(netMonthly,r);
    const realGrossMonthly=currentValueKRW(grossMonthly,r);
    const salary=Number(r.salaryIncome)||0;
    const salaryGrowth=Number(r.salaryGrowth)||0;
    const fireOther=Number(r.fireOtherIncome)||0;
    const dividend=Number(r.netDividend)||0;
    const totalCash=Number(r.totalCashIn)||salary+fireOther+dividend;
    const realTotalCash=currentValueKRW(totalCash,r);
    const cashflowBody=showCashflow?`<div class="tooltip-cashflow">
      <span class="tooltip-cashflow-label">월 Cashflow</span>
      <b class="tooltip-cashflow-total">총 ${compactKRW(totalCash)}/월</b>
      <strong class="tooltip-cashflow-real">현재가치 ${compactKRW(realTotalCash)}/월</strong>
      <div class="tooltip-cashflow-breakdown">
        <span><em>월급</em><b>${compactKRW(salary)}</b><small>연 ${salaryGrowth>=0?'+':''}${(salaryGrowth*100).toFixed(1)}%</small></span>
        <span><em>세후배당</em><b>${compactKRW(dividend)}</b></span>
        ${fireOther>0?`<span><em>FIRE 후 기타소득</em><b>${compactKRW(fireOther)}</b></span>`:''}
      </div>
    </div>`:'';
    const body=cashflowBody+`<div class="tooltip-monthly"><span>${monthlyLabel}</span><b>명목 ${compactKRW(netMonthly)}/월</b><strong>현재가치 ${compactKRW(realNetMonthly)}/월</strong><small>세전 명목 ${compactKRW(grossMonthly)}/월 · 현재가치 ${compactKRW(realGrossMonthly)}/월</small></div>`+
      series.map(s=>nominalRealHTML(s.label,r[s.key],r)).join('')+
      nominalRealHTML('월 적립금',r.monthlyContribution||0,r,'/월')+
      nominalRealHTML('생활비 필요액',r.requiredFromPortfolio,r,'/월');
    tip.innerHTML=`<strong>${calendarText(r,true)}</strong><small>${r.phase==='FIRE'?'🔥 FIRE 생활기':'축적기'} · ${(Number(r.year)||0).toFixed(1)}년 후</small>${body}`;

    const plotLeft=svgRect.left+(pad.l/W)*svgRect.width;
    const plotRight=svgRect.right-(pad.r/W)*svgRect.width;
    const fallbackX=plotLeft+(plotRight-plotLeft)*(idx/Math.max(1,rows.length-1));
    const px=(clientX==null?fallbackX:clientX)-stageRect.left;
    const py=(clientY==null?(svgRect.top+(pad.t/H)*svgRect.height+18):clientY)-stageRect.top;
    const available=Math.max(205,stageRect.width-16);
    const tw=Math.min(mobile?318:350,available);
    let left=px+14;
    if(left+tw>stageRect.width-8) left=px-tw-14;
    left=Math.max(8,Math.min(stageRect.width-tw-8,left));
    const top=Math.max(8,Math.min(Math.max(8,stageRect.height-130),py-22));
    tip.style.left=`${left}px`;tip.style.top=`${top}px`;tip.style.width=`${tw}px`;
    tip.classList.toggle('visible',showTip);
    tip.classList.toggle('pinned',pinned);

    const cashflowReadout=showCashflow?`<b class="readout-cashflow">Cashflow ${compactKRW(totalCash)}/월 = 월급 ${compactKRW(salary)} (연 ${salaryGrowth>=0?'+':''}${(salaryGrowth*100).toFixed(1)}%) + 세후배당 ${compactKRW(dividend)}${fireOther>0?` + FIRE 후 기타소득 ${compactKRW(fireOther)}`:''}</b>`:'';
    readout.innerHTML=`<strong>${calendarText(r,true)}</strong><span>${r.phase==='FIRE'?'🔥 FIRE 생활기':'축적기'}</span>${cashflowReadout}<b class="readout-monthly">${monthlyLabel} 명목 ${compactKRW(netMonthly)}/월 · 현재가치 ${compactKRW(realNetMonthly)}/월</b>${series.map(s=>`<b>${s.label} ${compactKRW(r[s.key])} (현재가치 ${compactKRW(currentValueKRW(r[s.key],r))})</b>`).join('')}<b>월 적립 ${compactKRW(r.monthlyContribution||0)} (현재가치 ${compactKRW(currentValueKRW(r.monthlyContribution||0,r))})</b><b>생활비 ${compactKRW(r.requiredFromPortfolio)} (현재가치 ${compactKRW(currentValueKRW(r.requiredFromPortfolio,r))})</b>`;
    readout.classList.add('active');
  }

  function indexFromClientX(clientX){
    const rect=svgEl.getBoundingClientRect();
    if(!rect.width)return 0;
    const plotLeft=rect.left+(pad.l/W)*rect.width;
    const plotRight=rect.right-(pad.r/W)*rect.width;
    const frac=Math.max(0,Math.min(1,(clientX-plotLeft)/Math.max(1,plotRight-plotLeft)));
    return nearestRowIndex(rows,frac*xmax);
  }
  function showFromPointer(ev){
    if(touching||Date.now()<ignoreMouseUntil||ev.pointerType==='touch')return;
    const idx=indexFromClientX(ev.clientX);
    renderRow(rows[idx],idx,ev.clientX,ev.clientY,true);
  }
  function showFromTouch(t,withHaptic=false){
    if(!t)return;
    const idx=indexFromClientX(t.clientX);
    if(withHaptic&&lastTouchIndex!=null&&idx!==lastTouchIndex)hapticTick();
    lastTouchIndex=idx;
    renderRow(rows[idx],idx,t.clientX,t.clientY,true);
  }

  // Desktop hover remains hover/click. Touch scrubbing is deliberately non-sticky.
  ['pointermove','mousemove'].forEach(type=>stage.addEventListener(type,showFromPointer,true));
  stage.addEventListener('pointerenter',showFromPointer,true);
  stage.addEventListener('mouseenter',showFromPointer,true);
  stage.addEventListener('pointerleave',()=>hide(),true);
  stage.addEventListener('mouseleave',()=>hide(),true);
  stage.addEventListener('click',ev=>{
    if(mobile||Date.now()-lastTouchAt<800)return;
    pinned=!pinned;
    showFromPointer(ev);
    tip.classList.toggle('pinned',pinned);
    if(!pinned)hide();
  });
  stage.addEventListener('touchstart',ev=>{
    const t=ev.touches&&ev.touches[0];if(!t)return;
    touching=true;pinned=false;lastTouchAt=Date.now();ignoreMouseUntil=Date.now()+900;lastTouchIndex=null;
    showFromTouch(t,false);
  },{passive:true,capture:true});
  stage.addEventListener('touchmove',ev=>{
    const t=ev.touches&&ev.touches[0];if(!t||!touching)return;
    ignoreMouseUntil=Date.now()+900;
    showFromTouch(t,true);
  },{passive:true,capture:true});
  const finishTouch=()=>{
    touching=false;pinned=false;lastTouchAt=Date.now();ignoreMouseUntil=Date.now()+900;lastTouchIndex=null;
    hide(true);
  };
  stage.addEventListener('touchend',finishTouch,{passive:true,capture:true});
  stage.addEventListener('touchcancel',finishTouch,{passive:true,capture:true});

  // Last-resort desktop path: track pointer at window level and map it back to this chart.
  // This bypasses SVG/overlay/browser hit-testing differences entirely.
  const globalMove=ev=>{
    if(touching||Date.now()<ignoreMouseUntil||ev.pointerType==='touch')return;
    const r=stage.getBoundingClientRect();
    const inside=ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom;
    if(inside) showFromPointer(ev);
    else if(!pinned) hide();
  };
  window.addEventListener('pointermove',globalMove,true);
  window.addEventListener('mousemove',globalMove,true);
  container._chartCleanup=()=>{
    window.removeEventListener('pointermove',globalMove,true);
    window.removeEventListener('mousemove',globalMove,true);
  };

  // Desktop keeps the initial readout. Mobile starts clean until the user scrubs.
  renderRow(rows[0],0,null,null,false);
  if(mobile)resetMobileReadout();
}

async function runSimulation(){
  if(!portfolio.length)return;const btn=$('#run'),status=$('#status');btn.disabled=true;status.className='status';status.textContent='LIVE 데이터 다운로드 및 2단계 FIRE 계산 중...';
  try{const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'시뮬레이션 실패');const withdrawal=j.fireMode==='withdrawal';
    const fm=milestoneText(j.fireMonth,j),failm=milestoneText(j.postFireFailureMonth,j);
    if(j.fireMonth==null){$('#fireCard').textContent='기간 내 미도달';}
    else{$('#fireCard').textContent=fm.main;}
    if(j.fireMonth!=null&&j.postFireFailureMonth!=null){$('#fireSub').textContent=`${fm.sub} · ⚠ ${failm.year}년 ${failm.month}월 (${ageText(failm.age)})부터 유지 실패`;$('#fireCard').closest('.metric').classList.add('warn');}
    else{$('#fireCard').closest('.metric').classList.remove('warn');$('#fireSub').textContent=j.fireMonth==null?'현재 가정에서 목표기간 내 현금흐름 부족':`${fm.sub} · ${withdrawal?'FIRE 후 적립 중단 · 배당+필요분 매도':'FIRE 후 적립 중단 · 원금 매도 없이 배당생활 유지'}`;}
    $('#assetCard').textContent=manwon(j.finalAssets);$('#assetSub').textContent=j.fireAssets!=null?`FIRE 시점 ${manwon(j.fireAssets)} · 그때까지 납입 ${manwon(j.fireContributed||0)}`:`목표기간 동안 계속 적립`;
    if(cashflowEnabled()){
      $('#currentDivCard').textContent=manwon(j.cashflowTotalInflow)+'/월';
      $('#yieldCard').textContent=`월 소득 ${manwon(j.cashflowIncome)} + 세후 배당 ${manwon(j.cashflowDividend)}`;
    }else{
      $('#currentDivCard').textContent=manwon(j.currentNetCashflow)+'/월';
      $('#yieldCard').textContent=withdrawal?`인출 ${(j.withdrawalRate*100).toFixed(1)}% · 가격성장 가정 ${pct01(j.weightedPriceGrowth)}`:`현재 분배율 ${pct01(j.weightedYield)} · 분배금 성장 ${pct01(j.weightedDistributionGrowth)} · 물가 ${(+$('#inflation').value||0).toFixed(1)}%`;
    }
    $('#finalDivCard').textContent=manwon(j.finalNetCashflow)+'/월';
    $('#finalLivingSub').textContent=withdrawal?`최종 포트폴리오 필요액 ${manwon(j.finalRequiredFromPortfolio)}/월`:`실질 월배당 ${manwon(j.finalRealNetDividend)} · 현재가치 필요액 ${manwon(j.finalRealRequired)}`;
    const remaining=cashflowEnabled()?j.cashflowRemaining:j.baseMonthlyRemaining;
    $('#surplusCard').textContent=manwon(remaining);$('#surplusCard').closest('.metric').classList.toggle('negative',remaining<0);
    renderCashflow(j);
    $('#taxCard').textContent=manwon(j.cumulativeTax);$('#taxSub').textContent=`배당세 ${manwon(j.cumulativeDividendTax)} · 매도세 ${manwon(j.cumulativeSaleTax)}`;
    $('#fxBadge').textContent=`USD/KRW ${Math.round(j.usdkrw).toLocaleString('ko-KR')} · ${j.fxSource.includes('DEMO')?'DEMO':'LIVE'}`;
    drawChart($('#assetChart'),j.rows,[{key:'assets',label:'총자산'},{key:'contributed',label:'누적 납입'}],j.fireMonth,j.fireMode,j.cashflowEnabled);
    drawChart($('#divChart'),j.rows,withdrawal?[{key:'netWithdrawal',label:'세후 n% 인출여력'},{key:'requiredFromPortfolio',label:'필요 생활비'}]:[{key:'netDividend',label:'세후 월배당'},{key:'requiredFromPortfolio',label:'필요 생활비'}],j.fireMonth,j.fireMode,j.cashflowEnabled);
    $('#stats').innerHTML=j.stats.map(s=>{const local=s.currency==='USD'?usd(s.price):manwon(s.price),src=s.source.includes('DEMO')?'⚠ DEMO':'LIVE',cls=s.source.includes('DEMO')?'demo':'live',hy=Number(s.history_years||0),hl=hy>=4.75?'약 5년':`${hy.toFixed(1)}년`;return `<tr><td><strong>${s.ticker}</strong></td><td>${pct01(s.weight)}</td><td>${local}</td><td>${manwon(s.price_krw)}</td><td>${pct01(s.yield)}</td><td>${pct01(s.historical_total_return_cagr)}</td><td>${hl}</td><td>${pct01(s.price_growth)}</td><td>${pct01(s.distribution_growth)}</td><td class="${cls}">${src}</td></tr>`;}).join('');
    const demo=j.stats.filter(s=>s.source.includes('DEMO')).map(s=>s.ticker);status.textContent=demo.length?`완료 · DEMO fallback: ${demo.join(', ')}`:'완료 · 모든 종목 LIVE 데이터 사용';
    if(scrollResultsAfterRun&&isMobileUI()){scrollResultsAfterRun=false;requestAnimationFrame(()=>$('#resultsPanel')?.scrollIntoView({behavior:'smooth',block:'start'}));}
  }catch(e){status.textContent='오류: '+e.message;status.className='status error';}finally{btn.disabled=false;}
}
$('#run').addEventListener('click',runSimulation);
$('#mobileRun')?.addEventListener('click',()=>{scrollResultsAfterRun=true;runSimulation();});
async function boot(){
  await verifyBuild();
  await loadSettings();
  renderPF();
  syncResponsiveFolds(true);
  renderContributionSchedule();
  updateModeUI();
  updateFoldSummaries();
  updateCashflowHint();
  bindAutoSave();
  scheduleSave();
  runSimulation();
}
boot();

// Desktop distribution heartbeat. Keeps the local app process alive while this UI is open.
(function fireDesktopHeartbeat(){
  const ping = () => fetch('/api/heartbeat', {method:'POST', cache:'no-store'}).catch(()=>{});
  ping();
  setInterval(ping, 15000);
})();

