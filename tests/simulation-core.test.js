const assert=require('assert');const core=require('../shared/simulation-core.js');
const market={usdkrw:1000,fxSource:'TEST',tickers:{TEST:{ticker:'TEST',currency:'USD',price:100,ttm_dps:6,yield:.06,historical_total_return_cagr:0,history_years:5,default_price_growth:0,default_distribution_growth:0,source:'TEST'}}};
const base={currentAge:25,startYear:2026,startMonth:1,initialCapital:600000000,monthlyIncome:0,fixedExpenses:0,monthlyContribution:0,fireExpenses:10000000,healthInsurance:0,postFireIncome:0,otherAnnualIncome:0,inflation:0,years:1,dividendStress:0,withdrawalRate:4,fireMode:'dividend',reinvest:false,portfolio:[{ticker:'TEST',weight:100,priceGrowth:0,distributionGrowth:0}]};
const r=core.simulate(base,market);assert.strictEqual(r.currentNetDividend,2550000);assert.strictEqual(r.currentGrossDividend,3000000);assert.strictEqual(r.currentMonthlyContribution,0);
const s=core.simulate({...base,monthlyContribution:9000000,contributionSchedule:{2026:0,2027:1000000},years:2},market);assert.strictEqual(s.currentMonthlyContribution,0);assert.strictEqual(s.contributionSchedule['2026'],0);assert.strictEqual(s.contributionSchedule['2027'],1000000);
console.log('simulation-core tests: PASS');

const cf=core.simulate({
  ...base,
  fireMode:'withdrawal',
  withdrawalRate:1,
  monthlyIncome:3000000,
  fireExpenses:1500000,
  monthlyContribution:1000000,
  cashflowEnabled:true,
  reinvest:true
},market);
assert.strictEqual(cf.cashflowIncome,3000000);
assert.strictEqual(cf.cashflowDividend,2550000);
assert.strictEqual(cf.cashflowTotalInflow,5550000,'income + after-tax dividend');
assert.strictEqual(cf.cashflowLivingCost,1500000);
assert.strictEqual(cf.cashflowContribution,1000000);
assert.strictEqual(cf.cashflowDividendReinvest,2550000);
assert.strictEqual(cf.cashflowRemaining,500000,'reinvested dividends must not be double-spendable');

const cfSpend=core.simulate({
  ...base,
  fireMode:'withdrawal',
  withdrawalRate:1,
  monthlyIncome:3000000,
  fireExpenses:1500000,
  monthlyContribution:1000000,
  fixedExpenses:999999999,
  cashflowEnabled:true,
  reinvest:false
},market);
assert.strictEqual(cfSpend.cashflowRemaining,3050000,'legacy fixedExpenses must be ignored and unreinvested dividend remains spendable');
console.log('cashflow tests: PASS');

const ready=core.simulate({...base,monthlyIncome:3000000,fireExpenses:0,monthlyContribution:1000000,reinvest:true,cashflowEnabled:true},market);
assert.strictEqual(ready.fireMonth,0);
assert.strictEqual(ready.cashflowContribution,1000000,'cashflow reflects the user current contribution even if FIRE-ready now');
assert.strictEqual(ready.baseMonthlyRemaining,2000000);
console.log('cashflow FIRE-ready display test: PASS');

const salaryHover=core.simulate({...base,monthlyIncome:3000000,fireExpenses:1500000,monthlyContribution:1000000,cashflowEnabled:true,reinvest:true},market);
assert.strictEqual(salaryHover.rows[0].salaryIncome,3000000);
assert.strictEqual(salaryHover.rows[0].netDividend,2550000);
assert.strictEqual(salaryHover.rows[0].totalCashIn,5550000,'hover cashflow row must expose salary + after-tax dividend');
console.log('hover cashflow row test: PASS');

const salaryRise=core.simulate({
  ...base,
  monthlyIncome:3000000,
  salaryGrowth:10,
  fireExpenses:10000000,
  years:3,
  cashflowEnabled:true
},market);
const salary0=salaryRise.rows.find(r=>r.month===0);
const salary12=salaryRise.rows.find(r=>r.month===12);
const salary24=salaryRise.rows.find(r=>r.month===24);
assert.strictEqual(salary0.salaryIncome,3000000);
assert.strictEqual(salary12.salaryIncome,3300000,'10% annual salary growth should apply after 12 months');
assert.strictEqual(salary24.salaryIncome,3630000,'annual salary growth should compound');
assert.strictEqual(salary12.salaryYear,1);
assert.strictEqual(salaryRise.salaryGrowth,0.10);
console.log('salary growth compounding test: PASS');

const delayedJob=core.simulate({
  ...base,
  startYear:2026,
  startMonth:1,
  monthlyIncome:3000000,
  salaryGrowth:10,
  employmentStartYear:2030,
  fireExpenses:10000000,
  years:6,
  cashflowEnabled:true
},market);
assert.strictEqual(delayedJob.rows.find(r=>r.month===0).salaryIncome,0,'salary must be zero before employment');
assert.strictEqual(delayedJob.cashflowIncome,0,'current cashflow salary must be zero when employment starts in the future');
assert.strictEqual(delayedJob.rows.find(r=>r.month===36).salaryIncome,0,'2029 salary should still be zero');
assert.strictEqual(delayedJob.rows.find(r=>r.month===48).salaryIncome,3000000,'2030 employment starts at the configured starting salary');
assert.strictEqual(delayedJob.rows.find(r=>r.month===60).salaryIncome,3300000,'salary growth begins after the first employment year');
assert.strictEqual(delayedJob.rows.find(r=>r.month===72).salaryIncome,3630000,'salary growth compounds from employment year, not simulation start');
assert.strictEqual(delayedJob.employmentStartYear,2030);
console.log('delayed employment start test: PASS');


const health36=Math.round(core.regionalHealthMonthlyFromFinancialIncome(36000000));
assert.strictEqual(core.highDividendSpecialTax(30000000),5280000,'2026 qualified high-dividend special tax incl. local tax');
assert.strictEqual(core.regionalHealthMonthlyFromFinancialIncome(9000000),0,'financial income at/below 10m should not add regional financial-income premium in this planning model');
assert.strictEqual(health36,244043);
assert.strictEqual(core.privatePensionWithdrawalRate(65),0.055);

const taxRows=core.cashflowTaxScenarios({
  annualForeignDividend:36000000,
  annualDomesticDividend:0,
  otherAnnualIncome:0,
  age:65,
  monthlyBaseHealth:150000,
  isaAllowance:2000000
});
const generalRow=taxRows.find(x=>x.key==='general');
const isaRow=taxRows.find(x=>x.key==='isa');
assert.strictEqual(generalRow.monthlyTax,450000);
assert.strictEqual(generalRow.monthlyIncomeHealth,244043);
assert.strictEqual(generalRow.spendableMonthly,2155957);
assert.strictEqual(isaRow.monthlyTax,280500);
assert.strictEqual(isaRow.spendableMonthly,2569500);

const autoHealth=core.simulate({...base,autoHealthInsurance:true,isaAllowance:2000000},market);
assert.strictEqual(autoHealth.currentNetDividend,2550000,'tax treatment remains backward-compatible');
assert.strictEqual(autoHealth.currentAutoHealthInsurance,244043);
assert.strictEqual(autoHealth.currentSpendableDividend,2305957);
assert.ok(Array.isArray(autoHealth.finalTaxScenarios)&&autoHealth.finalTaxScenarios.length===4);
console.log('2026 tax/health scenario tests: PASS');
