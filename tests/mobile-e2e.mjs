import { chromium, webkit } from 'playwright';
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
const waitDone=async page=>{
  try{
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('완료'),null,{timeout:10000});
  }catch(err){
    const debug=await page.evaluate(()=>({
      status:document.querySelector('#status')?.textContent||'',
      proof:document.querySelector('#buildProof')?.textContent||'',
      href:location.href
    })).catch(()=>({status:'<page unavailable>',proof:'',href:''}));
    console.error('waitDone debug:',JSON.stringify(debug));
    throw err;
  }
};

// Update-policy regression guard: PWA updates must never force-refresh an open session.
const pwaSource=await fs.readFile('web/pwa.js','utf8');
const swSource=await fs.readFile('web/service-worker.js','utf8');
assert.doesNotMatch(pwaSource,/location\.reload\s*\(/,'PWA update code must not force location.reload()');
assert.doesNotMatch(swSource,/self\.skipWaiting\s*\(/,'service worker updates must wait for the current session to close');
assert.doesNotMatch(swSource,/client\.navigate\s*\(/,'service worker must not navigate open clients during update');


await fs.mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const vp of [{width:360,height:800},{width:390,height:844},{width:430,height:932}]){
    const context=await browser.newContext({viewport:vp,deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>{const msg=String(e);errors.push(msg);console.error('pageerror:',msg);});
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
      // First-visit defaults: useful demo values, while saved user settings still override them.
      assert.equal(await page.locator('#age').inputValue(),'20');
      assert.equal(await page.locator('#initial').inputValue(),'500');
      assert.equal(await page.locator('#income').inputValue(),'300');
      assert.equal(await page.locator('#salaryGrowth').inputValue(),'3.6');
      assert.equal(await page.locator('#employmentStartYear').inputValue(),String(new Date().getFullYear()+5));
      assert.equal(await page.locator('#fireexp').inputValue(),'200');
      assert.equal(await page.locator('#contrib').inputValue(),'120');
      assert.equal(await page.locator('#cashflowEnabled').isChecked(),true);

      await page.locator('#initial').fill('60000');
      await page.locator('#income').fill('300');
      await page.locator('#salaryGrowth').fill('10');
      await page.locator('#employmentStartYear').fill(String(new Date().getFullYear()));
      await page.locator('#fireexp').fill('150');
      await page.locator('#contrib').fill('100');

      // With Cashflow off, dividends must not silently inflate spendable monthly remainder.
      await page.locator('#cashflowEnabled').uncheck();
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

      const salaryProjection=await page.evaluate(async()=>{
        const body={
          currentAge:25,startYear:new Date().getFullYear(),startMonth:new Date().getMonth()+1,
          initialCapital:600000000,monthlyIncome:3000000,salaryGrowth:10,monthlyContribution:1000000,
          fireExpenses:10000000,healthInsurance:0,postFireIncome:0,otherAnnualIncome:0,inflation:0,years:3,
          dividendStress:0,withdrawalRate:4,fireMode:'withdrawal',reinvest:true,cashflowEnabled:true,
          portfolio:[{ticker:'SCHD',weight:100,priceGrowth:0,distributionGrowth:0}]
        };
        const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const j=await r.json();
        return {m0:j.rows.find(x=>x.month===0)?.salaryIncome,m12:j.rows.find(x=>x.month===12)?.salaryIncome,m24:j.rows.find(x=>x.month===24)?.salaryIncome};
      });
      assert.equal(salaryProjection.m0,3000000);
      assert.equal(salaryProjection.m12,3300000);
      assert.equal(salaryProjection.m24,3630000);

      const delayedEmployment=await page.evaluate(async()=>{
        const body={
          currentAge:25,startYear:2026,startMonth:1,
          initialCapital:600000000,monthlyIncome:3000000,salaryGrowth:10,employmentStartYear:2030,monthlyContribution:1000000,
          fireExpenses:10000000,healthInsurance:0,postFireIncome:0,otherAnnualIncome:0,inflation:0,years:6,
          dividendStress:0,withdrawalRate:4,fireMode:'withdrawal',reinvest:true,cashflowEnabled:true,
          portfolio:[{ticker:'SCHD',weight:100,priceGrowth:0,distributionGrowth:0}]
        };
        const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const j=await r.json();
        return {
          now:j.rows.find(x=>x.month===0)?.salaryIncome,
          y2029:j.rows.find(x=>x.month===36)?.salaryIncome,
          y2030:j.rows.find(x=>x.month===48)?.salaryIncome,
          y2031:j.rows.find(x=>x.month===60)?.salaryIncome,
          cashflowIncome:j.cashflowIncome
        };
      });
      assert.equal(delayedEmployment.now,0);
      assert.equal(delayedEmployment.cashflowIncome,0);
      assert.equal(delayedEmployment.y2029,0);
      assert.equal(delayedEmployment.y2030,3000000);
      assert.equal(delayedEmployment.y2031,3300000);

      // Touch-scrub tooltip: salary + dividend must appear, movement should haptic-tick,
      // and lifting the finger must clear the hover overlay.
      const scrub=await page.evaluate(()=>{
        const stage=document.querySelector('#divChart .chart-stage');
        const tip=stage.querySelector('.chart-tooltip');
        const rect=stage.getBoundingClientRect();
        window.__dfVibes=0;window.__dfVibeDurations=[];
        try{Object.defineProperty(navigator,'vibrate',{configurable:true,value:(ms)=>{window.__dfVibes++;window.__dfVibeDurations.push(ms);return true;}});}catch(_){}
        const fire=(type,x)=>{
          const t=new Touch({identifier:7,target:stage,clientX:x,clientY:rect.top+100,pageX:x,pageY:rect.top+100,screenX:x,screenY:100});
          stage.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));
        };
        const svg=stage.querySelector('svg').getBoundingClientRect();
        const plotLeft=svg.left+svg.width*(54/360);
        fire('touchstart',plotLeft);
        const startText=tip.innerText;
        const visibleOnStart=tip.classList.contains('visible');
        const cash=tip.querySelector('.tooltip-cashflow');
        const cashDisplay=cash?getComputedStyle(cash).display:'';
        const cashRect=cash?cash.getBoundingClientRect():null;
        const cashOverflow=cash?Math.max(0,cash.scrollWidth-cash.clientWidth):999;
        fire('touchmove',plotLeft+70);
        fire('touchmove',plotLeft+140);
        const vibes=window.__dfVibes||0;
        const vibeDurations=window.__dfVibeDurations||[];
        const moveText=tip.innerText;
        fire('touchend',rect.left+250);
        const visibleAfterEnd=tip.classList.contains('visible');
        const lineVisible=stage.querySelector('.hover-line').getAttribute('visibility');
        return {startText,moveText,visibleOnStart,visibleAfterEnd,vibes,lineVisible,
          cashDisplay,cashWidth:cashRect?.width||0,cashOverflow,vibeDurations};
      });
      assert.equal(scrub.visibleOnStart,true);
      assert.match(scrub.startText,/월 cashflow/i);
      assert.match(scrub.startText,/월급\s+300만원/);
      assert.equal(scrub.cashDisplay,'block','cashflow card must stay vertically structured, not flex');
      assert.ok(scrub.cashWidth>=250,`cashflow tooltip too narrow: ${scrub.cashWidth}px`);
      assert.equal(scrub.cashOverflow,0,'cashflow card must not overflow horizontally');
      assert.ok(scrub.vibes>=1,`expected haptic ticks while scrubbing, got ${scrub.vibes}`);
      assert.ok(scrub.vibeDurations.every(ms=>Number(ms)<=3),`haptic tick should stay soft: ${scrub.vibeDurations.join(',')}`);
      assert.equal(scrub.visibleAfterEnd,false,'touch tooltip must disappear on finger-up');
      assert.equal(scrub.lineVisible,'hidden','touch hover line must disappear on finger-up');

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
      assert.equal(await page.locator('#salaryGrowth').inputValue(),'10');
      assert.equal(await page.locator('#employmentStartYear').inputValue(),String(new Date().getFullYear()));
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

  // Compact share-link round trip using the real-world sample that previously produced ~771 chars.
  const senderContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const sender=await senderContext.newPage();
  await sender.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
  await sender.goto(baseURL,{waitUntil:'networkidle'});
  await waitDone(sender);
  const sampleFields={
    age:'25',initial:'70000',income:'300',salaryGrowth:'4',employmentStartYear:'2031',
    contrib:'0',fireexp:'250',health:'15',postFireIncome:'0',otherincome:'0',
    inflation:'3.0',years:'40',withdrawalRate:'4',stress:'0'
  };
  await sender.evaluate(fields=>{
    Object.entries(fields).forEach(([id,value])=>{const el=document.querySelector('#'+id);if(el)el.value=value;});
    const dividend=document.querySelector('input[name="fireMode"][value="dividend"]');
    if(dividend) dividend.checked=true;
  },sampleFields);
  const shareUrl=await sender.evaluate(()=>createShareUrl());
  console.log('compact share URL length:',shareUrl.length);
  assert.match(shareUrl,/#s=v2\./,'new share URL must use compact v2 payload');
  assert.ok(shareUrl.length<=220,`compact share URL too long: ${shareUrl.length} chars`);
  await senderContext.close();

  const friendContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const friend=await friendContext.newPage();
  await friend.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
  await friend.goto(shareUrl,{waitUntil:'networkidle'});
  await waitDone(friend);
  assert.equal(await friend.locator('#sharedSettingsBanner').isVisible(),true,'shared settings must be previewed before apply');
  assert.equal(await friend.locator('#initial').inputValue(),'500','shared settings must not auto-overwrite receiver settings');
  assert.match(await friend.locator('#sharedSettingsSummary').innerText(),/70,000만원/);
  await friend.locator('#applySharedSettings').click();
  await waitDone(friend);
  assert.equal(await friend.locator('#initial').inputValue(),'70000');
  assert.equal(await friend.locator('#income').inputValue(),'300');
  assert.equal(await friend.locator('input[name="fireMode"][value="dividend"]').isChecked(),true);
  assert.equal(await friend.locator('#sharedSettingsBanner').isVisible(),false);
  assert.equal(await friend.evaluate(()=>location.hash),'','share hash should be removed after explicit apply');
  await friend.reload({waitUntil:'networkidle'});
  await waitDone(friend);
  assert.equal(await friend.locator('#initial').inputValue(),'70000','applied shared settings must persist');
  await friendContext.close();

  // Legacy v1 links must remain readable after v2 compact links ship.
  const legacyContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const legacyPage=await legacyContext.newPage();
  await legacyPage.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
  await legacyPage.goto(baseURL,{waitUntil:'networkidle'});
  await waitDone(legacyPage);
  const legacyUrl=await legacyPage.evaluate(()=>location.origin+location.pathname+'#share='+encodeLegacySharePayload(settingsSnapshot()));
  await legacyPage.close();
  const legacyReceiver=await legacyContext.newPage();
  await legacyReceiver.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
  await legacyReceiver.goto(legacyUrl,{waitUntil:'networkidle'});
  await waitDone(legacyReceiver);
  assert.equal(await legacyReceiver.locator('#sharedSettingsBanner').isVisible(),true,'legacy v1 share links must still open');
  await legacyContext.close();

  // Built-site smoke test without mocked market.json: validates the actual generated snapshot path.
  const realContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const realPage=await realContext.newPage();
  const realErrors=[];
  realPage.on('pageerror',err=>realErrors.push(String(err)));
  await realPage.goto(baseURL,{waitUntil:'networkidle'});
  await waitDone(realPage);
  assert.equal(realErrors.length,0,`real snapshot page errors: ${realErrors.join('; ')}`);
  assert.equal(await realPage.locator('#assetChart svg').count(),1,'real snapshot asset chart must render');
  assert.equal(await realPage.locator('#divChart svg').count(),1,'real snapshot cashflow chart must render');
  await realContext.close();

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

  console.log('chromium mobile e2e + cashflow + persistence + real snapshot + PWA offline: PASS');
} finally {
  await browser.close();
}

// Safari/iOS engine smoke test. This catches WebKit-only parser/layout/event regressions.
const safari=await webkit.launch({headless:true});
try{
  const context=await safari.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await waitDone(page);
  assert.equal(errors.length,0,`WebKit page errors: ${errors.join('; ')}`);
  assert.equal(await page.locator('.mobile-action-bar').isVisible(),true);
  assert.equal(await page.locator('#assetChart svg').count(),1);
  const webkitShareUrl=await page.evaluate(()=>createShareUrl());
  assert.match(webkitShareUrl,/#s=v2\./,'WebKit must support compact Deflate share links');
  assert.ok(webkitShareUrl.length<=220,`WebKit compact share URL too long: ${webkitShareUrl.length} chars`);
  const webkitReceiver=await context.newPage();
  await webkitReceiver.route('**/data/market.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(market)}));
  await webkitReceiver.goto(webkitShareUrl,{waitUntil:'networkidle'});
  await waitDone(webkitReceiver);
  assert.equal(await webkitReceiver.locator('#sharedSettingsBanner').isVisible(),true,'WebKit must decode compact share links');
  await webkitReceiver.close();
  await page.locator('#income').fill('321');
  await page.locator('#mobileRun').click();
  await waitDone(page);
  assert.equal(await page.locator('#income').inputValue(),'321');
  const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
  assert.ok(overflow<=1,`WebKit horizontal overflow ${overflow}px`);
  await page.screenshot({path:'test-results/mobile-webkit-390.png',fullPage:true});
  await context.close();
  console.log('webkit mobile smoke: PASS');
} finally {
  await safari.close();
}
