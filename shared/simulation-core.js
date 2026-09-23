// Dividend FIRE shared simulation core.
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.DividendFireCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function num(v,d){var n=Number(v);return Number.isFinite(n)?n:(d||0);}
function clamp(v,min,max){var n=num(v);return Math.max(min,Math.min(max,n));}
function rnd(v){return Math.round(num(v));}

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

// 2026 planning assumptions. Kept separate from the legacy tax path so older
// simulations keep their prior behavior unless the new UI opts in.
var HEALTH_INSURANCE_RATE_2026=.0719;
var LONG_TERM_CARE_RATIO_2026=.1314;
var FINANCIAL_INCOME_HEALTH_THRESHOLD=10000000;
var FINANCIAL_INCOME_COMPREHENSIVE_THRESHOLD=20000000;

function highDividendSpecialTax(domestic){
  domestic=Math.max(0,num(domestic));
  if(domestic<=0)return 0;
  var brackets=[[20000000,.14],[300000000,.20],[5000000000,.25],[Infinity,.30]];
  var national=0,lower=0;
  for(var i=0;i<brackets.length;i++){
    var upper=brackets[i][0],rate=brackets[i][1];
    var chunk=Math.min(domestic,upper)-lower;
    if(chunk>0)national+=chunk*rate;
    if(domestic<=upper)break;
    lower=upper;
  }
  return national*1.10;
}
function regionalHealthMonthlyFromAssessedIncome(annualAssessedIncome){
  annualAssessedIncome=Math.max(0,num(annualAssessedIncome));
  if(annualAssessedIncome<=0)return 0;
  var monthlyHealth=annualAssessedIncome*HEALTH_INSURANCE_RATE_2026/12;
  return monthlyHealth*(1+LONG_TERM_CARE_RATIO_2026);
}
function regionalHealthMonthlyFromFinancialIncome(annualFinancialIncome){
  annualFinancialIncome=Math.max(0,num(annualFinancialIncome));
  if(annualFinancialIncome<=FINANCIAL_INCOME_HEALTH_THRESHOLD)return 0;
  return regionalHealthMonthlyFromAssessedIncome(annualFinancialIncome);
}
function privatePensionWithdrawalRate(age){
  age=Math.max(0,num(age));
  return age>=80?.033:(age>=70?.044:.055);
}
function privatePensionCashflowTax(annualPension,age){
  annualPension=Math.max(0,num(annualPension));
  if(annualPension<=15000000)return annualPension*privatePensionWithdrawalRate(age);
  return annualPension*.165; // 연 1,500만원 초과 시 15% 분리과세 선택 + 지방소득세 가정
}
function cashflowTaxScenarios(opts){
  opts=opts||{};
  var foreign=Math.max(0,num(opts.annualForeignDividend));
  var domestic=Math.max(0,num(opts.annualDomesticDividend));
  var other=Math.max(0,num(opts.otherAnnualIncome));
  var gross=foreign+domestic;
  var age=Math.max(0,num(opts.age,65));
  var baseHealth=Math.max(0,num(opts.monthlyBaseHealth));
  var isaAllowance=Math.max(0,num(opts.isaAllowance,2000000));

  function row(key,label,tax,health,note,comprehensiveTriggered){
    tax=Math.max(0,num(tax)); health=Math.max(0,num(health));
    var afterTax=Math.max(0,(gross-tax)/12);
    return {
      key:key,label:label,grossMonthly:rnd(gross/12),annualTax:rnd(tax),monthlyTax:rnd(tax/12),
      monthlyIncomeHealth:rnd(health),monthlyBaseHealth:rnd(baseHealth),monthlyTotalHealth:rnd(baseHealth+health),
      spendableMonthly:rnd(Math.max(0,afterTax-baseHealth-health)),
      comprehensiveTaxTriggered:!!comprehensiveTriggered,
      note:note||''
    };
  }

  var generalTax=annualDividendTax(foreign,domestic,other);
  var generalHealth=regionalHealthMonthlyFromFinancialIncome(gross);
  var highTax=annualDividendTax(foreign,0,other)+highDividendSpecialTax(domestic);
  var highHealth=regionalHealthMonthlyFromFinancialIncome(gross);
  var isaTax=Math.max(0,gross-isaAllowance)*.099;
  var pensionTax=privatePensionCashflowTax(gross,age);
  var pensionHealth=regionalHealthMonthlyFromAssessedIncome(gross*.50);

  return [
    row('general','일반계좌',generalTax,generalHealth,'실제 포트폴리오 기준 · 금융소득종합과세와 지역가입자 소득분을 간이 반영',gross>FINANCIAL_INCOME_COMPREHENSIVE_THRESHOLD),
    row('highDividend','국내 고배당 분리과세',highTax,highHealth,domestic>0?'국내 적격 고배당 배당만 특례 적용':'현재 국내 배당이 없어 일반계좌와 실질적으로 동일',foreign>FINANCIAL_INCOME_COMPREHENSIVE_THRESHOLD),
    row('isa','ISA 가정',isaTax,0,'동일 분배율의 국내상장 대체상품을 ISA에서 보유한다고 가정 · 연간 스냅샷',false),
    row('pension','연금저축·IRP 가정',pensionTax,pensionHealth,gross>15000000?'적격 연금수령 · 연 1,500만원 초과 시 15% 분리과세 선택(지방세 포함 16.5%) 가정':'적격 연금수령 · 연령별 원천징수세율(지방세 포함) 가정',false)
  ];
}


function simulate(p,market){
  var years=Math.max(1,Math.min(parseInt(p.years==null?30:p.years,10)||30,60));
  var months=years*12,now=new Date();
  var currentAge=clamp(p.currentAge==null?25:p.currentAge,0,100);
  var startYear=clamp(parseInt(p.startYear==null?now.getFullYear():p.startYear,10),1900,2200);
  var startMonth=clamp(parseInt(p.startMonth==null?(now.getMonth()+1):p.startMonth,10),1,12);
  var initial=Math.max(0,num(p.initialCapital));
  var monthlyIncome=Math.max(0,num(p.monthlyIncome));
  var salaryGrowth=clamp(num(p.salaryGrowth,3)/100,-.50,1.00);
  var employmentStartYear=clamp(parseInt(p.employmentStartYear==null?startYear:p.employmentStartYear,10)||startYear,1900,2300);
  var monthlyContrib=Math.max(0,num(p.monthlyContribution));
  var cashflowEnabled=p.cashflowEnabled===true;
  var schedule={};
  if(p.contributionSchedule&&typeof p.contributionSchedule==='object'){
    Object.keys(p.contributionSchedule).forEach(function(y){
      var yi=parseInt(y,10),av=Math.max(0,num(p.contributionSchedule[y]));
      if(Number.isFinite(yi)&&yi>=1900&&yi<=2300)schedule[yi]=av;
    });
  }
  var fireExp=Math.max(0,num(p.fireExpenses));
  var health=Math.max(0,num(p.healthInsurance));
  var postFireIncome=Math.max(0,num(p.postFireIncome));
  var inflation=clamp(num(p.inflation,2.5)/100,-.02,.15);
  var otherIncome=Math.max(0,num(p.otherAnnualIncome));
  var autoHealthInsurance=p.autoHealthInsurance===true;
  var isaAllowance=Math.max(0,num(p.isaAllowance,2000000));
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

  var usdkrw=num(market.usdkrw,1400),fxSource=market.fxSource||'GitHub Actions snapshot';
  var stats=[],assets=[];
  for(var i=0;i<portfolio.length;i++){
    var item=portfolio[i],ticker=String(item.ticker||'').trim().toUpperCase();
    if(!ticker)continue;
    var weight=weights[i]/totalWeight;
    var s=(market.tickers||{})[ticker];
    if(!s)throw new Error(ticker+': 시장 데이터가 없습니다.');
    s=Object.assign({},s);
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
    var autoHealth=autoHealthInsurance?regionalHealthMonthlyFromFinancialIncome(grossDividend*12):0;
    var inflationFactor=Math.pow(1+inflation,year);
    var baseLivingCost=(fireExp+health)*inflationFactor;
    var livingCost=baseLivingCost+autoHealth;
    var postIncome=postFireIncome*inflationFactor;
    var required=Math.max(0,livingCost-postIncome);
    var totalAssets=securities+cash;
    var grossCapacity=totalAssets*withdrawalRate/12;
    var saleTaxCapacity=annualSaleTax(grossCapacity*12,foreignAssets,foreignBasis)/12;
    return {securities:securities,assets:totalAssets,basis:totalBasis,foreignAssets:foreignAssets,foreignBasis:foreignBasis,
      grossDividend:grossDividend,grossForeignDividend:grossForeign,grossDomesticDividend:grossDomestic,
      netDividend:netDividend,dividendTax:dividendTax,autoHealthInsurance:autoHealth,baseLivingCost:baseLivingCost,livingCost:livingCost,postFireIncome:postIncome,
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
    var employmentActive=cy>=employmentStartYear;
    var completedSalaryYears=employmentActive?Math.max(0,cy-employmentStartYear):0;
    var grownSalary=employmentActive?monthlyIncome*Math.pow(1+salaryGrowth,completedSalaryYears):0;
    var salaryIncome=employmentActive&&(m===0||phase!=='FIRE')?grownSalary:0;
    var fireOtherIncome=phase==='FIRE'?st.postFireIncome:0;
    var monthlyCashIncome=salaryIncome+fireOtherIncome;
    var totalCashIn=monthlyCashIncome+st.netDividend;
    return {month:m,year:Math.round((m/12)*100)/100,phase:phase,calendarYear:cy,calendarMonth:cm,age:Math.round(age*100)/100,
      assets:rnd(st.assets),securities:rnd(st.securities),cash:rnd(cash),contributed:rnd(contributed),monthlyContribution:rnd(applied||0),
      salaryIncome:rnd(salaryIncome),salaryGrowth:salaryGrowth,salaryYear:completedSalaryYears,employmentStartYear:employmentStartYear,employmentActive:employmentActive,fireOtherIncome:rnd(fireOtherIncome),monthlyCashIncome:rnd(monthlyCashIncome),totalCashIn:rnd(totalCashIn),
      grossDividend:rnd(st.grossDividend),netDividend:rnd(st.netDividend),dividendTax:rnd(st.dividendTax),
      grossForeignDividend:rnd(st.grossForeignDividend),grossDomesticDividend:rnd(st.grossDomesticDividend),
      autoHealthInsurance:rnd(st.autoHealthInsurance),baseLivingCost:rnd(st.baseLivingCost),
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
  var cashflowIncome=rows.length?rows[0].salaryIncome:0;
  var cashflowDividend=st0.netDividend;
  var cashflowTotalInflow=cashflowIncome+cashflowDividend;
  var cashflowLivingCost=fireExp;
  var cashflowContribution=currentMonthlyContribution;
  var cashflowDividendReinvest=reinvest?cashflowDividend:0;
  var baseMonthlyRemaining=cashflowIncome-cashflowLivingCost-cashflowContribution;
  var cashflowRemaining=cashflowTotalInflow-cashflowLivingCost-cashflowContribution-cashflowDividendReinvest;
  var realFactor=Math.pow(1+inflation,years);
  var currentBaseHealth=health;
  var finalBaseHealth=health*realFactor;
  var currentTaxScenarios=cashflowTaxScenarios({
    annualForeignDividend:st0.grossForeignDividend*12,
    annualDomesticDividend:st0.grossDomesticDividend*12,
    otherAnnualIncome:otherIncome,
    age:currentAge,
    monthlyBaseHealth:currentBaseHealth,
    isaAllowance:isaAllowance
  });
  var finalTaxScenarios=cashflowTaxScenarios({
    annualForeignDividend:final.grossForeignDividend*12,
    annualDomesticDividend:final.grossDomesticDividend*12,
    otherAnnualIncome:otherIncome,
    age:currentAge+years,
    monthlyBaseHealth:finalBaseHealth,
    isaAllowance:isaAllowance
  });
  var sortedSchedule={};
  Object.keys(schedule).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(y){sortedSchedule[y]=rnd(schedule[y]);});

  return {
    rows:rows,stats:stats,fireMode:fireMode,withdrawalRate:withdrawalRate,salaryGrowth:salaryGrowth,employmentStartYear:employmentStartYear,currentAge:currentAge,startYear:startYear,startMonth:startMonth,
    fireMonth:fireMonth,fireAssets:fireAssets==null?null:rnd(fireAssets),fireContributed:fireContributed==null?null:rnd(fireContributed),
    postFireFailureMonth:postFireFailureMonth,depletedMonth:depletedMonth,finalAssets:rnd(final.assets),finalCash:rnd(cash),
    weightedYield:weightedYield,weightedPriceGrowth:weightedPriceGrowth,weightedDistributionGrowth:weightedDistributionGrowth,
    cashflowEnabled:cashflowEnabled,monthlySurplus:rnd(baseMonthlyRemaining),baseMonthlyRemaining:rnd(baseMonthlyRemaining),currentMonthlyContribution:rnd(currentMonthlyContribution),
    cashflowIncome:rnd(cashflowIncome),cashflowDividend:rnd(cashflowDividend),cashflowTotalInflow:rnd(cashflowTotalInflow),
    cashflowLivingCost:rnd(cashflowLivingCost),cashflowContribution:rnd(cashflowContribution),
    cashflowDividendReinvest:rnd(cashflowDividendReinvest),cashflowRemaining:rnd(cashflowRemaining),
    contributionSchedule:sortedSchedule,currentNetDividend:rnd(st0.netDividend),currentGrossDividend:rnd(st0.grossDividend),
    currentAutoHealthInsurance:rnd(st0.autoHealthInsurance),currentSpendableDividend:rnd(Math.max(0,st0.netDividend-currentBaseHealth-st0.autoHealthInsurance)),
    currentTaxScenarios:currentTaxScenarios,
    currentNetWithdrawal:rnd(st0.netWithdrawalCapacity),currentGrossWithdrawal:rnd(st0.grossWithdrawalCapacity),
    finalNetDividend:rnd(final.netDividend),finalGrossDividend:rnd(final.grossDividend),
    finalAutoHealthInsurance:rnd(final.autoHealthInsurance),finalSpendableDividend:rnd(Math.max(0,final.netDividend-finalBaseHealth-final.autoHealthInsurance)),
    finalTaxScenarios:finalTaxScenarios,
    finalNetWithdrawal:rnd(final.netWithdrawalCapacity),
    finalGrossWithdrawal:rnd(final.grossWithdrawalCapacity),currentNetCashflow:rnd(fireMode==='withdrawal'?st0.netWithdrawalCapacity:st0.netDividend),
    finalNetCashflow:rnd(fireMode==='withdrawal'?final.netWithdrawalCapacity:final.netDividend),finalLivingCost:rnd(final.livingCost),
    finalRequiredFromPortfolio:rnd(final.requiredFromPortfolio),finalRealNetDividend:rnd(realFactor>0?final.netDividend/realFactor:final.netDividend),
    finalRealRequired:rnd(realFactor>0?final.requiredFromPortfolio/realFactor:final.requiredFromPortfolio),
    cumulativeDividendTax:rnd(cumDivTax),cumulativeSaleTax:rnd(cumSaleTax),cumulativeTax:rnd(cumDivTax+cumSaleTax),
    autoHealthInsurance:autoHealthInsurance,isaAllowance:rnd(isaAllowance),
    usdkrw:usdkrw,fxSource:fxSource,
    notes:['공용 시뮬레이션 코어에서 계산했습니다.','시장 데이터 공급원은 플랫폼 어댑터가 제공합니다.','세금·건보료는 계획용 간이 추정입니다.']
  };
}


return {
  simulate:simulate,
  progressiveIncomeTax:progressiveIncomeTax,
  annualDividendTax:annualDividendTax,
  annualSaleTax:annualSaleTax,
  highDividendSpecialTax:highDividendSpecialTax,
  regionalHealthMonthlyFromFinancialIncome:regionalHealthMonthlyFromFinancialIncome,
  regionalHealthMonthlyFromAssessedIncome:regionalHealthMonthlyFromAssessedIncome,
  privatePensionWithdrawalRate:privatePensionWithdrawalRate,
  privatePensionCashflowTax:privatePensionCashflowTax,
  cashflowTaxScenarios:cashflowTaxScenarios
};
});
