// Dividend FIRE browser/Tauri adapter. Math lives in shared/simulation-core.js.
(function(){
'use strict';
var WEB_VERSION='v2.0.13',WEB_BUILD='2026-09-22-v2.0.13-share-links-1',SETTINGS_KEY='DividendFireMVP.settings.v2';
var nativeFetch=window.fetch.bind(window),marketPromise=null;
var DEMO={
VOO:{ticker:'VOO',currency:'USD',price:600,ttm_dps:7.2,yield:.012,historical_total_return_cagr:.10,history_years:5,default_price_growth:.055,default_distribution_growth:.05,source:'DEMO FALLBACK'},
SCHD:{ticker:'SCHD',currency:'USD',price:34,ttm_dps:1.054,yield:.031,historical_total_return_cagr:.10,history_years:5,default_price_growth:.04,default_distribution_growth:.06,source:'DEMO FALLBACK'},
GLD:{ticker:'GLD',currency:'USD',price:330,ttm_dps:0,yield:0,historical_total_return_cagr:.12,history_years:5,default_price_growth:.03,default_distribution_growth:0,source:'DEMO FALLBACK'},
JEPQ:{ticker:'JEPQ',currency:'USD',price:60,ttm_dps:6.48,yield:.108,historical_total_return_cagr:.17,history_years:4.2,default_price_growth:.025,default_distribution_growth:0,source:'DEMO FALLBACK'},
QQQ:{ticker:'QQQ',currency:'USD',price:600,ttm_dps:3.6,yield:.006,historical_total_return_cagr:.14,history_years:5,default_price_growth:.065,default_distribution_growth:.05,source:'DEMO FALLBACK'},
VTI:{ticker:'VTI',currency:'USD',price:330,ttm_dps:4.62,yield:.014,historical_total_return_cagr:.10,history_years:5,default_price_growth:.055,default_distribution_growth:.05,source:'DEMO FALLBACK'},
JEPI:{ticker:'JEPI',currency:'USD',price:57,ttm_dps:4.275,yield:.075,historical_total_return_cagr:.09,history_years:5,default_price_growth:.02,default_distribution_growth:0,source:'DEMO FALLBACK'},
TLT:{ticker:'TLT',currency:'USD',price:90,ttm_dps:3.6,yield:.04,historical_total_return_cagr:-.01,history_years:5,default_price_growth:.01,default_distribution_growth:0,source:'DEMO FALLBACK'},
SGOV:{ticker:'SGOV',currency:'USD',price:100,ttm_dps:4,yield:.04,historical_total_return_cagr:.04,history_years:5,default_price_growth:0,default_distribution_growth:0,source:'DEMO FALLBACK'}};
function num(v,d){var n=Number(v);return Number.isFinite(n)?n:(d||0);}
function response(obj,status){return new Response(JSON.stringify(obj),{status:status||200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function platform(){return window.__TAURI_INTERNALS__?'tauri':'web';}
function loadMarket(){if(!marketPromise){marketPromise=nativeFetch('./data/market.json?ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('market snapshot unavailable');return r.json();}).catch(()=>({generated_at:null,usdkrw:1400,fxSource:'DEMO FALLBACK',tickers:Object.assign({},DEMO)}));}return marketPromise;}
async function getStats(ticker){var m=await loadMarket(),t=String(ticker||'').trim().toUpperCase(),s=(m.tickers||{})[t]||DEMO[t];if(!s)throw new Error('현재 스냅샷에 없는 티커입니다.');return Object.assign({},s);}
async function api(raw,options){
 var u=new URL(raw,location.href),path=u.pathname,method=String((options&&options.method)||'GET').toUpperCase();
 if(path.includes('/api/version'))return response({version:WEB_VERSION,build:WEB_BUILD,web:true,platform:platform(),core:'shared-js'});
 if(path.includes('/api/heartbeat'))return response({ok:true,platform:platform()});
 if(path.includes('/api/quit'))return response({ok:true,platform:platform()});
 if(path.includes('/api/settings')){
  if(method==='POST'){try{var b=JSON.parse((options&&options.body)||'{}');localStorage.setItem(SETTINGS_KEY,JSON.stringify(b));return response({ok:true,storage:'localStorage'});}catch(e){return response({error:String(e.message||e)},400);}}
  try{var r=localStorage.getItem(SETTINGS_KEY);return response({settings:r?JSON.parse(r):{}});}catch(_){return response({settings:{}});}
 }
 if(path.includes('/api/ticker')){try{var t=(u.searchParams.get('ticker')||'').trim().toUpperCase();if(!t)return response({error:'티커를 입력해 주세요.'},400);var s=await getStats(t),m=await loadMarket(),fx=String(s.currency||'USD').toUpperCase()==='USD'?num(m.usdkrw,1400):1;return response(Object.assign({},s,{price_krw:num(s.price)*fx,usdkrw:num(m.usdkrw,1400),fxSource:m.fxSource||'GitHub Actions snapshot'}));}catch(e){return response({error:String(e.message||e)},404);}}
 if(path.includes('/api/simulate')){try{if(!window.DividendFireCore)throw new Error('공용 계산 코어를 불러오지 못했습니다.');var p=JSON.parse((options&&options.body)||'{}'),m=await loadMarket();return response(window.DividendFireCore.simulate(p,m));}catch(e){return response({error:String(e.message||e)},400);}}
 return null;
}
window.fetch=async function(input,options){options=options||{};var raw=typeof input==='string'?input:(input&&input.url)||'';try{var u=new URL(raw,location.href);if(u.pathname.includes('/api/')){var h=await api(raw,options);if(h)return h;}}catch(_){}return nativeFetch(input,options);};
window.addEventListener('DOMContentLoaded',function(){var n=document.querySelector('.notice p');if(n)n.textContent=(platform()==='tauri'?'Desktop Edition':'Web/PWA Edition')+'은 공용 JavaScript 계산 코어를 사용합니다. 설정은 기기에 저장되고 시장 데이터는 빌드 시 포함된 스냅샷을 사용합니다. 종목별 성장률은 미래 예측이 아니라 사용자가 조정하는 가정이며 세금·건보료는 계획용 간이 추정입니다.';});
})();
