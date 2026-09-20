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
    await fs.mkdir('test-results',{recursive:true});
    await page.screenshot({path:`test-results/mobile-${vp.width}-initial.png`,fullPage:true});

    assert.equal(errors.length,0,`page errors at ${vp.width}: ${errors.join('; ')}`);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    assert.ok(overflow<=1,`horizontal overflow ${overflow}px at ${vp.width}`);
    assert.equal(await page.locator('.mobile-action-bar').isVisible(),true);
    assert.equal(await page.locator('.mobile-quick-nav').isVisible(),true);
    assert.equal(await page.locator('#annualDetails').getAttribute('open'),null,'annual schedule should start collapsed on mobile');

    const smallTargets=await page.locator('button:visible, a:visible, summary:visible').evaluateAll(els=>els.map(el=>({t:(el.textContent||'').trim().slice(0,30),h:el.getBoundingClientRect().height})).filter(x=>x.h<39));
    assert.deepEqual(smallTargets,[],`touch targets too small at ${vp.width}: ${JSON.stringify(smallTargets)}`);

    if(vp.width===390){
      await page.locator('#initial').fill('60000');
      await page.locator('#income').fill('300');
      await page.locator('#fireexp').fill('150');
      await page.locator('#contrib').fill('100');
      await page.locator('#cashflowEnabled').check();
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('완료'));

      assert.match(await page.locator('#cfIncome').innerText(),/300/);
      assert.match(await page.locator('#cfDividend').innerText(),/255/);
      assert.match(await page.locator('#cfTotal').innerText(),/555/);
      assert.match(await page.locator('#cfLiving').innerText(),/150/);
      assert.match(await page.locator('#cfContribution').innerText(),/100/);
      assert.match(await page.locator('#cfReinvest').innerText(),/255/);
      assert.match(await page.locator('#cfRemaining').innerText(),/50/);

      await page.locator('#fireDetails summary').click();
      await page.locator('#reinvest').uncheck();
      await page.locator('#mobileRun').click();
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('완료'));
      assert.match(await page.locator('#cfRemaining').innerText(),/305/);

      await page.locator('#annualDetails summary').click();
      const year=String(new Date().getFullYear());
      const yr=page.locator(`.annual-contrib-input[data-year="${year}"]`);
      assert.equal(await yr.count(),1);
      await yr.fill('0');
      await page.locator('#mobileRun').click();
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('완료'));
      assert.match(await page.locator('#cfContribution').innerText(),/^0/);

      const overflowOpen=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
      assert.ok(overflowOpen<=1,`overflow after interactions: ${overflowOpen}`);
      await page.screenshot({path:'test-results/mobile-390-cashflow.png',fullPage:true});
    }
    await context.close();
  }
  console.log('mobile e2e: PASS');
} finally {
  await browser.close();
}
