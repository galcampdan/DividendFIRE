
// Dividend FIRE Web Edition API shim.
// Static GitHub Pages build: browser simulation + localStorage settings + Actions market snapshot.
(function(){
'use strict';

var WEB_VERSION='v8.9.3';
var WEB_BUILD='2026-09-19-v8.9.3-nominal-real-hover-1';
var SETTINGS_KEY='DividendFireMVP.settings.v2';
var nativeFetch=window.fetch.bind(window);
var marketPromise=null;

var DEMO={
VOO:{ticker:'VOO',currency:'USD',price:600,ttm_dps:7.2,yield:.012,historical_total_return_cagr:.10,history_years:5,default_price_growth:.055,default_distribution_growth:.05,source:'DEMO FALLBACK'},
SCHD:{ticker:'SCHD',currency:'USD',price:34,ttm_dps:1.054,yield:.031,historical_total_return_cagr:.10,history_years:5,default_price_growth:.04,default_distribution_growth:.06,source:'DEMO FALLBACK'},
GLD:{ticker:'GLD',currency:'USD',price:330,ttm_dps:0,yield:0,historical_total_return_cagr:.12,history_years:5,default_price_growth:.03,default_distribution_growth:0,source:'DEMO FALLBACK'},
JEPQ:{ticker:'JEPQ',currency:'USD',price:60,ttm_dps:6.48,yield:.108,historical_total_return_cagr:.17,history_years:4.2,default_price_growth:.025,default_distribution_growth:0,source:'DEMO FALLBACK'},
QQQ:{ticker:'QQQ',currency:'USD',price:600,ttm_dps:3.6,yield:.006,historical_total_return_cagr:.14,history_years:5,default_price_growth:.065,default_distribution_growth:.05,source:'DEMO FALLBACK'},
VTI:{ticker:'VTI',currency:'USD',price:330,ttm_dps:4.62,yield:.014,historical_total_return_cagr:.10,history_years:5,default_price_growth:.055,default_distribution_growth:.05,source:'DEMO FALLBACK'},
JEPI:{ticker:'JEPI',currency:'USD',price:57,ttm_dps:4.275,yield:.075,historical_total_return_cagr:.09,history_years:5,default_price_growth:.02,default_distribution_growth:0,source:'DEMO FALLBACK'},
TLT:{ticker:'TLT',currency:'USD',price:90,ttm_dps:3.6,yield:.04,historical_total_return_cagr:-.01,history_years:5,default_price_growth:.01,default_distribution_growth:0,source:'DEMO FALLBACK'},
SGOV:{ticker:'SGOV',currency:'USD',price:100,ttm_dps:4,yield:.04,historical_total_return_cagr:.04,history_years:5,default_price_growth:0,default_distribution_growth:0,source:'DEMO FALLBACK'}
};

function num(v,d){var n=Number(v);return Number.isFinite(n)?n:(d||0);}
function clamp(v,min,max){var n=num(v);return Math.max(min,Math.min(max,n));}
function rnd(v){return Math.round(num(v));}
function response(obj,status){
  return new Response(JSON.stringify(obj),{status:status||200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
function loadMarket(){
  if(!marketPromise){
    marketPromise=nativeFetch('./data/market.json?ts='+Date.now(),{cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('market snapshot unavailable');return r.json();})
      .catch(function(){return {generated_at:null,usdkrw:1400,fxSource:'DEMO FALLBACK',tickers:DEMO};});
  }
  return marketPromise;
}
function getStats(ticker){
  return loadMarket().then(function(m){
    var t=String(ticker||'').trim().toUpperCase();
    var s=(m.tickers||{})[t]||DEMO[t];
    if(!s)throw new Error('웹판 시장 스냅샷에 없는 티커입니다. 데스크톱판에서는 실시간 조회가 가능합니다.');
    return Object.assign({},s);
  });
}

function progressiveIncomeTax(taxable){
  taxable=Math.max(0,num(taxable));
  var brackets=[[14000000,.06],[50000000,.15],[88000000,.24],[150000000,.35],[300000000,.38],[500000000,.40],[1000000000,.42],[Infinity,.45]];
  var tax=0,lower=0;
  for(var i=0;i<brackets.length;i++){
    var upper=brackets[i][0],rate=brackets[i][1];
    var chunk=Math.min(taxable,upper)-lower;
    if(chunk>0)tax+=chunk*rate;
    if(taxable<=upper)break;
    lower=upper;
  }
  return tax;
}
function annualDividendTax(foreign,domestic,other){
  foreign=Math.max(0,num(foreign)); domestic=Math.max(0,num(domestic)); other=Math.max(0,num(other));
  var gross=foreign+domestic;
  if(gross<=0)return 0;
  var base=foreign*.15+domestic*.154;
  if(gross<=20000000)return base;
  var before=progressiveIncomeTax(other),after=progressiveIncomeTax(other+gross);
  return Math.max(base,Math.max(0,after-before)*1.10);
}
function annualSaleTax(grossSale,foreignAssets,foreignBasis){
  grossSale=Math.max(0,num(grossSale)); foreignAssets=Math.max(0,num(foreignAssets)); foreignBasis=Math.max(0,num(foreignBasis));
  if(grossSale<=0||foreignAssets<=0)return 0;
  var gain=Math.max(0,foreignAssets-foreignBasis);
  var realized=grossSale*(gain/foreignAssets);
  return Math.max(0,realized-2500000)*.22;
}

async function simulate(p){
  var years=Math.max(1,Math.min(parseInt(p.years==null?30:p.years,10)||30,60));
  var months=years*12,now=new Date();
  var currentAge=clamp(p.currentAge==null?25:p.currentAge,0,100);
  var startYear=clamp(parseInt(p.startYear==null?now.getFullYear():p.startYear,10),1900,2200);
  var startMonth=clamp(parseInt(p.startMonth==null?(now.getMonth()+1):p.startMonth,10),1,12);
  var initial=Math.max(0,num(p.initialCapital));
  var monthlyIncome=Math.max(0,num(p.monthlyIncome));
  var fixed=Math.max(0,num(p.fixedExpenses));
  var monthlyContrib=Math.max(0,num(p.monthlyContribution));
  var schedule={};
  if(p.contributionSchedule&&typeof p.contributionSchedule==='object'){
    Object.keys(p.contributionSchedule).forEach(function(y){
      var yi=parseInt(y,10),av=Math.max(0,num(p.contributionSchedule[y]));
      if(Number.isFinite(yi)&&yi>=1900&&yi<=2300)schedule[yi]=av;
    });
  }
  var fireExp=Math.max(0,num(p.fireExpenses,fixed));
  var health=Math.max(0,num(p.healthInsurance));
  var postFireIncome=Math.max(0,num(p.postFireIncome));
  var inflation=clamp(num(p.inflation,2.5)/100,-.02,.15);
  var otherIncome=Math.max(0,num(p.otherAnnualIncome));
  var reinvest=p.reinvest!==false;
  var stress=clamp(num(p.dividendStress)/100,0,.90);
  var fireMode=String(p.fireMode||'withdrawal').toLowerCase();
  if(fireMode!=='withdrawal'&&fireMode!=='dividend')fireMode='withdrawal';
  var withdrawalRate=clamp(num(p.withdrawalRate,4)/100,.001,.20);
  var portfolio=Array.isArray(p.portfolio)?p.portfolio:[];
  if(!portfolio.length)throw new Error('포트폴리오가 비어 있습니다.');
  var weights=portfolio.map(function(x){return Math.max(0,num(x.weight));});
  var totalWeight=weights.reduce(function(a,b){return a+b;},0);
  if(totalWeight<=0)throw new Error('포트폴리오 비중 합계가 0%입니다.');

  var market=await loadMarket();
  var usdkrw=num(market.usdkrw,1400),fxSource=market.fxSource||'GitHub Actions snapshot';
  var stats=[],assets=[];
  for(var i=0;i<portfolio.length;i++){
    var item=portfolio[i],ticker=String(item.ticker||'').trim().toUpperCase();
    if(!ticker)continue;
    var weight=weights[i]/totalWeight;
    var s=await getStats(ticker);
    var currency=String(s.currency||'USD').toUpperCase();
    if(currency!=='USD'&&currency!=='KRW')throw new Error(ticker+': 웹판은 USD/KRW 종목만 지원합니다.');
    var fx=currency==='USD'?usdkrw:1;
    var price=Math.max(.000001,num(s.price));
    var priceKrw=price*fx,initialValue=initial*weight,shares=priceKrw>0?initialValue/priceKrw:0;
    var pg=item.priceGrowth,dg=item.distributionGrowth;
    var priceGrowth=pg==null?num(s.default_price_growth,.04):clamp(num(pg)/100,-.5,.5);
    var distGrowth=dg==null?num(s.default_distribution_growth,.02):clamp(num(dg)/100,-.5,.5);
    var stat=Object.assign({},s,{weight:weight,price_krw:priceKrw,price_growth:priceGrowth,distribution_growth:distGrowth});
    stats.push(stat);
    assets.push({ticker:ticker,weight:weight,currency:currency,fx:fx,shares:shares,price:price,annual_dps:Math.max(0,num(s.ttm_dps)),price_growth:priceGrowth,distribution_growth:distGrowth,cost_basis:initialValue});
  }
  if(!assets.length)throw new Error('유효한 종목이 없습니다.');

  var contributed=initial,cash=0,retired=false,fireMonth=null,fireAssets=null,fireContributed=null;
  var postFireFailureMonth=null,depletedMonth=null,cumDivTax=0,cumSaleTax=0,rows=[];

  function calendarYearForMonth(m){return startYear+Math.floor(((startMonth-1)+m)/12);}
  function scheduledContribution(m){var y=calendarYearForMonth(m);return Object.prototype.hasOwnProperty.call(schedule,y)?schedule[y]:monthlyContrib;}
  function marketState(year){
    var grossForeign=0,grossDomestic=0,securities=0,foreignAssets=0,foreignBasis=0,totalBasis=0;
    assets.forEach(function(a){
      var value=a.shares*a.price*a.fx; securities+=value; totalBasis+=a.cost_basis;
      var gd=a.shares*a.annual_dps*a.fx/12*(1-stress);
      if(a.currency==='USD'){grossForeign+=gd;foreignAssets+=value;foreignBasis+=a.cost_basis;}else grossDomestic+=gd;
    });
    var grossDividend=grossForeign+grossDomestic;
    var dividendTax=annualDividendTax(grossForeign*12,grossDomestic*12,otherIncome)/12;
    var netDividend=Math.max(0,grossDividend-dividendTax);
    var livingCost=(fireExp+health)*Math.pow(1+inflation,year);
    var postIncome=postFireIncome*Math.pow(1+inflation,year);
    var required=Math.max(0,livingCost-postIncome);
    var totalAssets=securities+cash;
    var grossCapacity=totalAssets*withdrawalRate/12;
    var saleTaxCapacity=annualSaleTax(grossCapacity*12,foreignAssets,foreignBasis)/12;
    return {securities:securities,assets:totalAssets,basis:totalBasis,foreignAssets:foreignAssets,foreignBasis:foreignBasis,
      grossDividend:grossDividend,netDividend:netDividend,dividendTax:dividendTax,livingCost:livingCost,postFireIncome:postIncome,
      requiredFromPortfolio:required,grossWithdrawalCapacity:grossCapacity,netWithdrawalCapacity:Math.max(0,grossCapacity-saleTaxCapacity),
      withdrawalCapacityTax:saleTaxCapacity};
  }
  function fireReady(st){
    if(st.requiredFromPortfolio<=0)return true;
    return fireMode==='dividend'?st.netDividend>=st.requiredFromPortfolio:st.netWithdrawalCapacity>=st.requiredFromPortfolio;
  }
  function buy(amount){
    if(amount<=0)return;
    assets.forEach(function(a){var amt=amount*a.weight,unit=a.price*a.fx;if(unit>0){a.shares+=amt/unit;a.cost_basis+=amt;}});
  }
  function reinvestAmount(amount){
    if(amount<=0)return;
    assets.forEach(function(a){var amt=amount*a.weight,unit=a.price*a.fx;if(unit>0){a.shares+=amt/unit;a.cost_basis+=amt;}});
  }
  function sellSecurities(grossSale){
    var sec=assets.reduce(function(s,a){return s+a.shares*a.price*a.fx;},0);
    if(sec<=0||grossSale<=0)return 0;
    var actual=Math.min(grossSale,sec);
    assets.forEach(function(a){
      var value=a.shares*a.price*a.fx;if(value<=0)return;
      var portion=actual*(value/sec),frac=Math.min(1,portion/value);
      a.shares*=1-frac;a.cost_basis*=1-frac;
    });
    return actual;
  }
  function makeRow(m,st,phase,shortfall,sale,saleTax,applied){
    var total=(startMonth-1)+m,cy=startYear+Math.floor(total/12),cm=(total%12)+1,age=currentAge+m/12;
    return {month:m,year:Math.round((m/12)*100)/100,phase:phase,calendarYear:cy,calendarMonth:cm,age:Math.round(age*100)/100,
      assets:rnd(st.assets),securities:rnd(st.securities),cash:rnd(cash),contributed:rnd(contributed),monthlyContribution:rnd(applied||0),
      grossDividend:rnd(st.grossDividend),netDividend:rnd(st.netDividend),dividendTax:rnd(st.dividendTax),
      grossWithdrawal:rnd(st.grossWithdrawalCapacity),netWithdrawal:rnd(st.netWithdrawalCapacity),withdrawalTax:rnd(st.withdrawalCapacityTax),
      livingCost:rnd(st.livingCost),postFireIncome:rnd(st.postFireIncome),requiredFromPortfolio:rnd(st.requiredFromPortfolio),
      shortfall:rnd(shortfall||0),actualSale:rnd(sale||0),actualSaleTax:rnd(saleTax||0)};
  }

  var st0=marketState(0);
  if(fireReady(st0)){retired=true;fireMonth=0;fireAssets=st0.assets;fireContributed=contributed;}
  rows.push(makeRow(0,st0,retired?'FIRE':'ACCUMULATION',0,0,0,retired?0:scheduledContribution(0)));

  for(var m=1;m<=months;m++){
    var year=m/12;
    assets.forEach(function(a){a.price*=Math.pow(1+a.price_growth,1/12);a.annual_dps*=Math.pow(1+a.distribution_growth,1/12);});
    if(!retired){
      var mc=scheduledContribution(m);
      if(mc>0){buy(mc);contributed+=mc;}
      var st=marketState(year);cumDivTax+=st.dividendTax;
      if(reinvest)reinvestAmount(st.netDividend);else cash+=st.netDividend;
      st=marketState(year);
      if(fireReady(st)){retired=true;fireMonth=m;fireAssets=st.assets;fireContributed=contributed;}
      if(m%3===0||m===months)rows.push(makeRow(m,st,retired?'FIRE':'ACCUMULATION',0,0,0,mc));
      continue;
    }
    var fst=marketState(year);cumDivTax+=fst.dividendTax;
    var netDiv=fst.netDividend,need=fst.requiredFromPortfolio,shortfall=0,sale=0,saleTax=0;
    if(fireMode==='dividend'){
      var available=cash+netDiv;
      if(available>=need){
        var remainder=available-need;cash=0;
        if(reinvest&&remainder>0)reinvestAmount(remainder);else cash=remainder;
      }else{
        shortfall=need-available;cash=0;if(postFireFailureMonth==null)postFireFailureMonth=m;
      }
    }else{
      var available2=cash+netDiv;
      if(available2>=need)cash=available2-need;
      else{
        var remainingNeed=need-available2;cash=0,pre=marketState(year),gross=remainingNeed;
        for(var k=0;k<5;k++){saleTax=annualSaleTax(gross*12,pre.foreignAssets,pre.foreignBasis)/12;gross=remainingNeed+saleTax;}
        sale=sellSecurities(gross);cumSaleTax+=saleTax;
        var netSale=Math.max(0,sale-saleTax);
        if(netSale+1e-6<remainingNeed){
          shortfall=remainingNeed-netSale;if(depletedMonth==null)depletedMonth=m;if(postFireFailureMonth==null)postFireFailureMonth=m;
        }
      }
    }
    fst=marketState(year);
    if(fst.assets<=1&&depletedMonth==null){depletedMonth=m;if(postFireFailureMonth==null)postFireFailureMonth=m;}
    if(m%3===0||m===months)rows.push(makeRow(m,fst,'FIRE',shortfall,sale,saleTax,0));
  }

  var final=marketState(years);
  var weightedYield=stats.reduce(function(s,x){return s+num(x.yield)*num(x.weight);},0);
  var weightedPriceGrowth=stats.reduce(function(s,x){return s+num(x.price_growth)*num(x.weight);},0);
  var ysum=stats.reduce(function(s,x){return s+num(x.yield)*num(x.weight);},0);
  var weightedDistributionGrowth=ysum>0?stats.reduce(function(s,x){return s+num(x.distribution_growth)*num(x.yield)*num(x.weight);},0)/ysum:0;
  var currentMonthlyContribution=scheduledContribution(0);
  var realFactor=Math.pow(1+inflation,years);
  var sortedSchedule={};
  Object.keys(schedule).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(y){sortedSchedule[y]=rnd(schedule[y]);});

  return {
    rows:rows,stats:stats,fireMode:fireMode,withdrawalRate:withdrawalRate,currentAge:currentAge,startYear:startYear,startMonth:startMonth,
    fireMonth:fireMonth,fireAssets:fireAssets==null?null:rnd(fireAssets),fireContributed:fireContributed==null?null:rnd(fireContributed),
    postFireFailureMonth:postFireFailureMonth,depletedMonth:depletedMonth,finalAssets:rnd(final.assets),finalCash:rnd(cash),
    weightedYield:weightedYield,weightedPriceGrowth:weightedPriceGrowth,weightedDistributionGrowth:weightedDistributionGrowth,
    monthlySurplus:rnd(monthlyIncome-fixed-currentMonthlyContribution),currentMonthlyContribution:rnd(currentMonthlyContribution),
    contributionSchedule:sortedSchedule,currentNetDividend:rnd(st0.netDividend),currentGrossDividend:rnd(st0.grossDividend),
    currentNetWithdrawal:rnd(st0.netWithdrawalCapacity),currentGrossWithdrawal:rnd(st0.grossWithdrawalCapacity),
    finalNetDividend:rnd(final.netDividend),finalGrossDividend:rnd(final.grossDividend),finalNetWithdrawal:rnd(final.netWithdrawalCapacity),
    finalGrossWithdrawal:rnd(final.grossWithdrawalCapacity),currentNetCashflow:rnd(fireMode==='withdrawal'?st0.netWithdrawalCapacity:st0.netDividend),
    finalNetCashflow:rnd(fireMode==='withdrawal'?final.netWithdrawalCapacity:final.netDividend),finalLivingCost:rnd(final.livingCost),
    finalRequiredFromPortfolio:rnd(final.requiredFromPortfolio),finalRealNetDividend:rnd(realFactor>0?final.netDividend/realFactor:final.netDividend),
    finalRealRequired:rnd(realFactor>0?final.requiredFromPortfolio/realFactor:final.requiredFromPortfolio),
    cumulativeDividendTax:rnd(cumDivTax),cumulativeSaleTax:rnd(cumSaleTax),cumulativeTax:rnd(cumDivTax+cumSaleTax),
    usdkrw:usdkrw,fxSource:fxSource,
    notes:['Web Edition은 데스크톱 v8.9.3 계산 로직을 브라우저에서 실행합니다.','시장 데이터는 GitHub Actions 스냅샷을 사용합니다.','설정은 현재 브라우저 localStorage에 저장됩니다.','세금·건보료는 계획용 간이 추정입니다.']
  };
}

async function api(raw,options){
  var u=new URL(raw,location.href),path=u.pathname,method=String((options&&options.method)||'GET').toUpperCase();
  if(path.indexOf('/api/version')>=0)return response({version:WEB_VERSION,build:WEB_BUILD,web:true});
  if(path.indexOf('/api/heartbeat')>=0)return response({ok:true,web:true});
  if(path.indexOf('/api/quit')>=0)return response({ok:true,web:true});
  if(path.indexOf('/api/settings')>=0){
    if(method==='POST'){
      try{var b=JSON.parse((options&&options.body)||'{}');localStorage.setItem(SETTINGS_KEY,JSON.stringify(b));return response({ok:true,storage:'localStorage'});}
      catch(e){return response({error:String(e.message||e)},400);}
    }
    try{var r=localStorage.getItem(SETTINGS_KEY);return response({settings:r?JSON.parse(r):{}});}catch(_){return response({settings:{}});}
  }
  if(path.indexOf('/api/ticker')>=0){
    try{
      var t=(u.searchParams.get('ticker')||'').trim().toUpperCase();if(!t)return response({error:'티커를 입력해 주세요.'},400);
      var s=await getStats(t),m=await loadMarket(),fx=s.currency==='USD'?num(m.usdkrw,1400):1;
      return response(Object.assign({},s,{price_krw:num(s.price)*fx,usdkrw:num(m.usdkrw,1400),fxSource:m.fxSource||'GitHub Actions snapshot'}));
    }catch(e){return response({error:String(e.message||e)},404);}
  }
  if(path.indexOf('/api/simulate')>=0){
    try{var body=JSON.parse((options&&options.body)||'{}');return response(await simulate(body));}
    catch(e){return response({error:String(e.message||e)},400);}
  }
  return null;
}

window.fetch=async function(input,options){
  options=options||{};
  var raw=typeof input==='string'?input:(input&&input.url)||'';
  try{
    var u=new URL(raw,location.href);
    if(u.pathname.indexOf('/api/')>=0){
      var handled=await api(raw,options);
      if(handled)return handled;
    }
  }catch(_){}
  return nativeFetch(input,options);
};

window.addEventListener('DOMContentLoaded',function(){
  var notice=document.querySelector('.notice p');
  if(notice)notice.textContent='Web Edition은 계산을 브라우저에서 실행하고 설정을 이 브라우저에 저장합니다. 시장 데이터는 GitHub Actions가 주기적으로 갱신한 스냅샷을 사용합니다. FIRE 계산과 그래프 hover는 데스크톱판과 같은 계열의 로직을 사용합니다. 종목별 성장률은 예측값이 아니라 사용자가 조정하는 가정이며, 세금·건보료는 계획용 간이 추정입니다.';
  var proof=document.querySelector('#buildProof');
  if(proof)proof.title='GitHub Pages Web Edition';
});
})();
