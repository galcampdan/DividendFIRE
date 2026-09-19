#!/usr/bin/env python3
import json, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "data" / "market.json"
TICKERS = [
    "VOO","SCHD","GLD","JEPQ","QQQ","VTI","JEPI","TLT","SGOV",
    "SPY","IVV","VT","VUG","VIG","DGRO","DIVO","QYLD","XYLD",
    "RSP","BND","AGG","IWM","DIA","SPLG","USFR","BIL","GOVT",
    "XLK","XLF","XLV","XLE","VNQ"
]
DEFAULT_PRICE_GROWTH = {
    "VOO":.055,"SCHD":.040,"GLD":.030,"JEPQ":.025,"QQQ":.065,
    "VTI":.055,"JEPI":.020,"TLT":.010,"SGOV":0.0
}
DEFAULT_DISTRIBUTION_GROWTH = {
    "VOO":.050,"SCHD":.060,"GLD":0.0,"JEPQ":0.0,"QQQ":.050,
    "VTI":.050,"JEPI":0.0,"TLT":0.0,"SGOV":0.0
}
DEMO = {
    "VOO": (600,.012,.10,5.0),"SCHD":(34,.031,.10,5.0),"GLD":(330,0,.12,5.0),
    "JEPQ":(60,.108,.17,4.2),"QQQ":(600,.006,.14,5.0),"VTI":(330,.014,.10,5.0),
    "JEPI":(57,.075,.09,5.0),"TLT":(90,.04,-.01,5.0),"SGOV":(100,.04,.04,5.0)
}

def req_json(url, timeout=20):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 DividendFIRE-WebSnapshot/1.0"})
    with urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def yahoo_chart(ticker, years=5):
    end=int(time.time()); start=end-int(years*365.25*86400)
    url=(f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(ticker)}"
         f"?period1={start}&period2={end}&interval=1mo&events=div%2Csplits&includeAdjustedClose=true")
    data=req_json(url); chart=data.get("chart") or {}
    if chart.get("error"): raise RuntimeError(str(chart["error"]))
    res=(chart.get("result") or [None])[0]
    if not res: raise RuntimeError("no result")
    meta=res.get("meta") or {}; timestamps=res.get("timestamp") or []
    indicators=res.get("indicators") or {}; q=(indicators.get("quote") or [{}])[0]
    closes=q.get("close") or []; adj=(indicators.get("adjclose") or [{}])[0].get("adjclose") or []
    perf=adj if adj and len(adj)==len(timestamps) else closes
    pts=[(int(ts),float(v)) for ts,v in zip(timestamps,perf) if v is not None and float(v)>0]
    current=float(meta.get("regularMarketPrice") or next((x for x in reversed(closes) if x),0) or 0)
    if current<=0: raise RuntimeError("price unavailable")
    cagr=0.0; history_years=0.0
    if len(pts)>=2:
        history_years=max((pts[-1][0]-pts[0][0])/(365.25*86400),.01)
        cagr=(pts[-1][1]/pts[0][1])**(1/history_years)-1 if pts[0][1]>0 else 0
    dividends=(res.get("events") or {}).get("dividends") or {}
    cutoff=end-365*86400
    ttm=sum(float(v.get("amount") or 0) for v in dividends.values() if int(v.get("date") or 0)>=cutoff)
    yld=ttm/current if current>0 else 0
    return {
        "ticker":ticker,"currency":str(meta.get("currency") or "USD").upper(),
        "price":current,"ttm_dps":max(0,ttm),"yield":max(0,min(yld,.30)),
        "historical_total_return_cagr":max(-.5,min(cagr,.5)),"history_years":history_years,
        "default_price_growth":DEFAULT_PRICE_GROWTH.get(ticker,.04),
        "default_distribution_growth":DEFAULT_DISTRIBUTION_GROWTH.get(ticker,.02),
        "source":"Yahoo Finance SNAPSHOT"
    }

def demo(t):
    p,y,h,hy=DEMO[t]
    return {"ticker":t,"currency":"USD","price":p,"ttm_dps":p*y,"yield":y,
            "historical_total_return_cagr":h,"history_years":hy,
            "default_price_growth":DEFAULT_PRICE_GROWTH.get(t,.04),
            "default_distribution_growth":DEFAULT_DISTRIBUTION_GROWTH.get(t,.02),
            "source":"DEMO FALLBACK"}

def main():
    data={}
    for t in TICKERS:
        try:
            data[t]=yahoo_chart(t)
            print("LIVE",t)
        except Exception as e:
            if t in DEMO:
                data[t]=demo(t); print("DEMO",t,e)
            else:
                print("SKIP",t,e)
    try:
        fx=yahoo_chart("USDKRW=X")["price"]; fx_source="Yahoo Finance SNAPSHOT"
    except Exception as e:
        fx=1400.0; fx_source="DEMO FALLBACK"; print("FX DEMO",e)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload={"schema":1,"generated_at":datetime.now(timezone.utc).isoformat(),
             "usdkrw":fx,"fxSource":fx_source,"tickers":data}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("wrote",OUT,len(data),"tickers")

if __name__=="__main__":
    main()
