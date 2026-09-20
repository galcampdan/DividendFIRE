import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const baseURL=process.env.TEST_BASE_URL||'http://127.0.0.1:4173/';
const market={
  generated_at:'TEST',usdkrw:1000,fxSource:'TEST SNAPSHOT',
  tickers:{
    SCHD:{ticker:'SCHD',currency:'USD',price:100,ttm_dps:6,yield:.06,historical_total_return_cagr:.1,history_years:5,default_price_growth:0,default_distribution_growth:0,source:'TEST'},
    JEPQ:{ticker:'JEPQ',currency:'USD',price:100,ttm_dps:6,yield:.06,historical_total_return_cagr:.1,history_years:5,default_price_growth:0,default_distribution_growth:0,source:'TEST'},
    VOO:{ticker:'VOO',currency:'USD',price:100,ttm_dps:2,yield:.02,historical_total_return_cagr:.1,history_years:5,default_price_growth:0,default_distribution_growth:0,source:'TEST'}
  }
};
const waitDone=page=>page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('완료'));

await fs.mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const vp of [{width:360,height:800},{width:390,height:844},{width:430,height:932}]){
    const context=await browser.newContext({viewport:vp,deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
    await page.goto(baseURL,{waitUntil:'networkidle'});
    await page.waitForSelector('#resultsPanel');
    await waitDone(page);
    await page.screenshot({path:`test-results/mobile-${vp.width}-initial.png`,fullPage:true});

    assert.equal(errors.length,0,`page errors at ${vp.width}: ${errors.join('; ')}`);
    assert.equal(await page.locator('#fixed').count(),0,'removed fixed-cost input must not return');
    assert.equal(await page.locator('link[rel="manifest"]').count(),1,'PWA manifest link missing');
    assert.equal(await page.locator('#assetChart svg').count(),1,'asset chart must render');
    assert.equal(await page.locator('#divChart svg').count(),1,'cashflow chart must render');

    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    assert.ok(overflow<=1,`horizontal overflow ${overflow}px at ${vp.width}`);
    assert.equal(await page.locator('.mobile-action-bar').isVisible(),true);
    assert.equal(await page.locator('.mobile-quick-nav').isVisible(),true);
    assert.equal(await page.locator('#annualDetails').getAttribute('open'),null,'annual schedule should start collapsed on mobile');
    assert.equal(await page.locator('#fireDetails').getAttribute('open'),null,'FIRE assumptions should start collapsed on mobile');
    assert.equal(await page.locator('#portfolioDetails').getAttribute('open'),null,'portfolio should start collapsed on mobile');
    assert.equal(await page.locator('.annual-contrib-input').count(),10,'mobile should initially render only 10 contribution years');

    const smallTargets=await page.locator('button:visible, a:visible, summary:visible').evaluateAll(els=>els.map(el=>({t:(el.textContent||'').trim().slice(0,30),h:el.getBoundingClientRect().height})).filter(x=>x.h<39));
    assert.deepEqual(smallTargets,[],`touch targets too small at ${vp.width}: ${JSON.stringify(smallTargets)}`);

    if(vp.width===360){
      const titleLines=await page.locator('.hero h1').evaluate(el=>Math.round(el.getBoundingClientRect().height/parseFloat(getComputedStyle(el).lineHeight)));
      assert.equal(titleLines,1,'360px title should remain one line');
    }

    if(vp.width===390){
      await page.locator('#initial').fill('60000');
      await page.locator('#income').fill('300');
      await page.locator('#fireexp').fill('150');
      await page.locator('#contrib').fill('100');

      // With Cashflow off, dividends must not silently inflate spendable monthly remainder.
      await page.locator('#mobileRun').click();
      await waitDone(page);
      assert.match(await page.locator('#surplusCard').innerText(),/50/,'base remainder should be income - living - contribution');

      // Detailed Cashflow: income 300 + after-tax dividend 255 = 555.
      await page.locator('#cashflowEnabled').check();
      await waitDone(page);
      assert.match(await page.locator('#cfIncome').innerText(),/300/);
      assert.match(await page.locator('#cfDividend').innerText(),/255/);
      assert.match(await page.locator('#cfTotal').innerText(),/555/);
      assert.match(await page.locator('#cfLiving').innerText(),/150/);
      assert.match(await page.locator('#cfContribution').innerText(),/100/);
      assert.match(await page.locator('#cfReinvest').innerText(),/255/);
      assert.match(await page.locator('#cfRemaining').innerText(),/50/);
      assert.match(await page.locator('#currentDivCard').innerText(),/555/);

      // Collapsed FIRE controls must remain fully functional.
      if(!(await page.locator('#fireDetails').getAttribute('open'))) await page.locator('#fireDetails summary').click();
      await page.locator('.mode-switch label').filter({hasText:'배당소득 생활'}).click();
      assert.equal(await page.locator('input[name="fireMode"][value="dividend"]').isChecked(),true);
      assert.equal(await page.locator('#withdrawalRateField').isVisible(),false);
      assert.equal(await page.locator('#dividendStressField').isVisible(),true);
      await page.locator('.mode-switch label').filter({hasText:'n% 인출'}).click();
      assert.equal(await page.locator('input[name="fireMode"][value="withdrawal"]').isChecked(),true);
      assert.equal(await page.locator('#withdrawalRateField').isVisible(),true);

      await page.locator('#reinvest').uncheck();
      await page.locator('#mobileRun').click();
      await waitDone(page);
      assert.match(await page.locator('#cfReinvest').innerText(),/^0/);
      assert.match(await page.locator('#cfRemaining').innerText(),/305/);

      // Progressive disclosure: 10 years first, then all configured years.
      if(!(await page.locator('#annualDetails').getAttribute('open'))) await page.locator('#annualDetails summary').click();
      assert.equal(await page.locator('.annual-contrib-input').count(),10);
      await page.locator('#showMoreContributionYears').click();
      assert.equal(await page.locator('.annual-contrib-input').count(),40);
      const year=String(new Date().getFullYear());
      const yr=page.locator(`.annual-contrib-input[data-year="${year}"]`);
      await yr.fill('0');
      await page.locator('#mobileRun').click();
      await waitDone(page);
      assert.match(await page.locator('#cfContribution').innerText(),/^0/);

      // Portfolio CRUD and weight normalization using the actual UI.
      if(!(await page.locator('#portfolioDetails').getAttribute('open'))) await page.locator('#portfolioDetails summary').click();
      await page.locator('#newTicker').fill('VOO');
      await page.locator('#addTicker').click();
      await page.waitForFunction(()=>document.querySelector('#tickerStatus')?.textContent?.includes('VOO 추가됨'));
      assert.equal(await page.locator('.portfolio-row').count(),3);
      assert.match(await page.locator('#portfolioSummary').innerText(),/VOO/);
      const weightTotal=await page.locator('.weight-number').evaluateAll(els=>els.reduce((s,e)=>s+Number(e.value||0),0));
      assert.ok(Math.abs(weightTotal-100)<0.2,`portfolio weight sum should be 100, got ${weightTotal}`);

      // Autosave/localStorage must survive reload, including cashflow and year override.
      await page.waitForTimeout(400);
      await page.reload({waitUntil:'networkidle'});
      await waitDone(page);
      assert.equal(await page.locator('#income').inputValue(),'300');
      assert.equal(await page.locator('#cashflowEnabled').isChecked(),true);
      assert.equal(await page.locator('.portfolio-row').count(),3);
      if(!(await page.locator('#annualDetails').getAttribute('open'))) await page.locator('#annualDetails summary').click();
      assert.equal(await page.locator(`.annual-contrib-input[data-year="${year}"]`).inputValue(),'0');

      const overflowOpen=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
      assert.ok(overflowOpen<=1,`overflow after interactions: ${overflowOpen}`);
      await page.screenshot({path:'test-results/mobile-390-cashflow.png',fullPage:true});
    }
    await context.close();
  }

  // PWA installation/update/offline shell check on a real Service Worker context.
  const pwaContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  const pwaPage=await pwaContext.newPage();
  const pwaErrors=[];
  pwaPage.on('pageerror',e=>pwaErrors.push(String(e)));
  await pwaPage.goto(baseURL,{waitUntil:'networkidle'});
  await pwaPage.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await pwaPage.reload({waitUntil:'networkidle'});
  await pwaPage.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await pwaContext.setOffline(true);
  await pwaPage.reload({waitUntil:'domcontentloaded'});
  await pwaPage.waitForSelector('#inputsPanel');
  assert.equal(pwaErrors.length,0,`PWA page errors: ${pwaErrors.join('; ')}`);
  assert.equal(await pwaPage.locator('#inputsPanel').isVisible(),true,'PWA shell should load offline');
  await pwaContext.close();

  console.log('mobile e2e + cashflow + persistence + PWA offline: PASS');
} finally {
  await browser.close();
}
