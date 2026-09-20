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
