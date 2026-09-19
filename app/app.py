import json
import math
import os
import time
import webbrowser
import threading
import sys
import shutil
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

# Static application resources live with the executable/bundle.
# Mutable user data NEVER lives in Program Files or beside the EXE.
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    RESOURCE_ROOT = sys._MEIPASS
else:
    RESOURCE_ROOT = os.path.dirname(os.path.abspath(__file__))

STATIC = os.path.join(RESOURCE_ROOT, "static")

_local_appdata = os.environ.get("LOCALAPPDATA")
if not _local_appdata:
    _local_appdata = os.path.join(os.path.expanduser("~"), "AppData", "Local")
USER_DATA_DIR = os.path.join(_local_appdata, "DividendFIRE")
os.makedirs(USER_DATA_DIR, exist_ok=True)
SETTINGS_FILE = os.path.join(USER_DATA_DIR, "settings.json")
PID_FILE = os.path.join(USER_DATA_DIR, "fire.pid")

# One-time migration from the earlier development builds.
LEGACY_SETTINGS_FILE = os.path.join(_local_appdata, "DividendFireMVP", "settings.json")
if not os.path.exists(SETTINGS_FILE) and os.path.exists(LEGACY_SETTINGS_FILE):
    try:
        shutil.copy2(LEGACY_SETTINGS_FILE, SETTINGS_FILE)
    except OSError:
        pass

KNOWN_TICKERS = {"VOO", "SCHD", "GLD", "JEPQ", "QQQ", "VTI", "JEPI", "TLT", "SGOV"}

# Planning assumptions only — NOT forecasts. v7 separates NAV/price growth from distribution growth.
DEFAULT_PRICE_GROWTH = {
    "VOO": 0.055, "SCHD": 0.040, "GLD": 0.030, "JEPQ": 0.025,
    "QQQ": 0.065, "VTI": 0.055, "JEPI": 0.020, "TLT": 0.010, "SGOV": 0.000,
}
DEFAULT_DISTRIBUTION_GROWTH = {
    "VOO": 0.050, "SCHD": 0.060, "GLD": 0.000, "JEPQ": 0.000,
    "QQQ": 0.050, "VTI": 0.050, "JEPI": 0.000, "TLT": 0.000, "SGOV": 0.000,
}

DEMO = {
    "VOO": (600, 0.012, 0.10, 5.0),
    "SCHD": (34, 0.031, 0.10, 5.0),
    "GLD": (330, 0.0, 0.12, 5.0),
    "JEPQ": (60, 0.108, 0.17, 4.2),
    "QQQ": (600, 0.006, 0.14, 5.0),
    "VTI": (330, 0.014, 0.10, 5.0),
    "JEPI": (57, 0.075, 0.09, 5.0),
    "TLT": (90, 0.04, -0.01, 5.0),
    "SGOV": (100, 0.04, 0.04, 5.0),
}


def _request_json(url, timeout=12):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 DividendFireMVP/8.8"})
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def yahoo_chart(ticker, years=5):
    ticker = ticker.upper().strip()
    end = int(time.time())
    start = end - int(years * 365.25 * 24 * 3600)
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?period1={start}&period2={end}&interval=1mo&events=div%2Csplits&includeAdjustedClose=true"
    )
    data = _request_json(url)
    chart = data.get("chart") or {}
    if chart.get("error"):
        raise ValueError(chart["error"].get("description") or "Yahoo data error")
    results = chart.get("result") or []
    if not results:
        raise ValueError("Ticker not found")

    res = results[0]
    meta = res.get("meta") or {}
    currency = (meta.get("currency") or "USD").upper()
    timestamps = res.get("timestamp") or []
    indicators = res.get("indicators") or {}
    quote = (indicators.get("quote") or [{}])[0]
    closes = quote.get("close") or []
    adj = (indicators.get("adjclose") or [{}])[0].get("adjclose") or []
    perf_source = adj if adj and len(adj) == len(timestamps) else closes
    perf_pts = []
    for ts, value in zip(timestamps, perf_source):
        if value is None:
            continue
        value = float(value)
        if value > 0:
            perf_pts.append((int(ts), value))

    current = float(meta.get("regularMarketPrice") or next((x for x in reversed(closes) if x), 0) or 0)
    if current <= 0:
        raise ValueError("Current price unavailable")

    historical_total_return_cagr = 0.0
    history_years = 0.0
    if len(perf_pts) >= 2:
        history_years = max((perf_pts[-1][0] - perf_pts[0][0]) / (365.25 * 24 * 3600), 0.01)
        first, last = perf_pts[0][1], perf_pts[-1][1]
        if first > 0 and last > 0:
            historical_total_return_cagr = (last / first) ** (1 / history_years) - 1

    dividend_events = (res.get("events") or {}).get("dividends") or {}
    cutoff = end - 365 * 24 * 3600
    ttm_dps = 0.0
    for v in dividend_events.values():
        amount = v.get("amount")
        ts = v.get("date")
        if amount is not None and ts is not None and int(ts) >= cutoff:
            ttm_dps += float(amount)
    dividend_yield = ttm_dps / current if current > 0 else 0.0

    return {
        "ticker": ticker,
        "currency": currency,
        "price": current,
        "ttm_dps": max(0.0, ttm_dps),
        "yield": max(0.0, min(dividend_yield, 0.30)),
        "historical_total_return_cagr": max(-0.50, min(historical_total_return_cagr, 0.50)),
        "history_years": history_years,
        "default_price_growth": DEFAULT_PRICE_GROWTH.get(ticker, 0.04),
        "default_distribution_growth": DEFAULT_DISTRIBUTION_GROWTH.get(ticker, 0.02),
        "source": "Yahoo Finance LIVE",
    }


def fx_usdkrw():
    try:
        d = yahoo_chart("USDKRW=X", years=1)
        return float(d["price"]), "Yahoo Finance LIVE"
    except Exception:
        return 1400.0, "DEMO FALLBACK"


def demo_stats(ticker):
    ticker = ticker.upper().strip()
    if ticker not in DEMO:
        raise ValueError(f"'{ticker}' 데이터를 확인할 수 없습니다. 티커를 다시 확인해 주세요.")
    price, yld, hist, hist_years = DEMO[ticker]
    return {
        "ticker": ticker, "currency": "USD", "price": price,
        "ttm_dps": price * yld, "yield": yld,
        "historical_total_return_cagr": hist, "history_years": hist_years,
        "default_price_growth": DEFAULT_PRICE_GROWTH.get(ticker, 0.04),
        "default_distribution_growth": DEFAULT_DISTRIBUTION_GROWTH.get(ticker, 0.02),
        "source": "DEMO FALLBACK",
    }


def get_stats(ticker, allow_demo=True):
    try:
        return yahoo_chart(ticker)
    except Exception:
        if allow_demo and ticker.upper() in KNOWN_TICKERS:
            return demo_stats(ticker)
        raise


def progressive_income_tax(taxable_krw):
    taxable = max(0.0, taxable_krw)
    brackets = [
        (14_000_000, 0.06), (50_000_000, 0.15), (88_000_000, 0.24),
        (150_000_000, 0.35), (300_000_000, 0.38), (500_000_000, 0.40),
        (1_000_000_000, 0.42), (float("inf"), 0.45),
    ]
    tax = 0.0
    lower = 0.0
    for upper, rate in brackets:
        chunk = min(taxable, upper) - lower
        if chunk > 0:
            tax += chunk * rate
        if taxable <= upper:
            break
        lower = upper
    return tax


def annual_dividend_tax(gross_foreign_krw, gross_domestic_krw, other_taxable_income_krw=0):
    foreign = max(0.0, gross_foreign_krw)
    domestic = max(0.0, gross_domestic_krw)
    gross = foreign + domestic
    if gross <= 0:
        return 0.0
    base_withholding = foreign * 0.15 + domestic * 0.154
    if gross <= 20_000_000:
        return base_withholding
    before = progressive_income_tax(other_taxable_income_krw)
    after = progressive_income_tax(other_taxable_income_krw + gross)
    simplified_comprehensive = max(0.0, after - before) * 1.10
    return max(base_withholding, simplified_comprehensive)


def annual_sale_tax(gross_sale_krw, foreign_assets_krw, foreign_basis_krw):
    gross_sale = max(0.0, gross_sale_krw)
    foreign_assets = max(0.0, foreign_assets_krw)
    if gross_sale <= 0 or foreign_assets <= 0:
        return 0.0
    gain = max(0.0, foreign_assets - max(0.0, foreign_basis_krw))
    gain_ratio = gain / foreign_assets if foreign_assets > 0 else 0.0
    realized_gain = gross_sale * gain_ratio
    taxable_gain = max(0.0, realized_gain - 2_500_000)
    return taxable_gain * 0.22


def simulate(payload):
    years = max(1, min(int(payload.get("years", 30)), 60))
    months = years * 12
    now = datetime.now()
    current_age = max(0.0, min(float(payload.get("currentAge", 25)), 100.0))
    start_year = max(1900, min(int(payload.get("startYear", now.year)), 2200))
    start_month = max(1, min(int(payload.get("startMonth", now.month)), 12))
    initial = max(0.0, float(payload.get("initialCapital", 0)))
    monthly_income = max(0.0, float(payload.get("monthlyIncome", 0)))
    fixed = max(0.0, float(payload.get("fixedExpenses", 0)))
    monthly_contrib = max(0.0, float(payload.get("monthlyContribution", 0)))
    raw_contribution_schedule = payload.get("contributionSchedule") or {}
    contribution_schedule = {}
    if isinstance(raw_contribution_schedule, dict):
        for y, amount in raw_contribution_schedule.items():
            try:
                year_key = int(y)
                amount_value = max(0.0, float(amount))
            except (TypeError, ValueError):
                continue
            if 1900 <= year_key <= 2300:
                contribution_schedule[year_key] = amount_value
    fire_exp = max(0.0, float(payload.get("fireExpenses", fixed)))
    health = max(0.0, float(payload.get("healthInsurance", 0)))
    post_fire_income = max(0.0, float(payload.get("postFireIncome", 0)))
    inflation = max(-0.02, min(float(payload.get("inflation", 2.5)) / 100, 0.15))
    other_income = max(0.0, float(payload.get("otherAnnualIncome", 0)))
    reinvest = bool(payload.get("reinvest", True))
    stress = max(0.0, min(float(payload.get("dividendStress", 0)) / 100, 0.90))
    fire_mode = str(payload.get("fireMode", "withdrawal")).strip().lower()
    if fire_mode not in {"withdrawal", "dividend"}:
        fire_mode = "withdrawal"
    withdrawal_rate = max(0.001, min(float(payload.get("withdrawalRate", 4.0)) / 100, 0.20))
    portfolio = payload.get("portfolio") or []
    if not portfolio:
        raise ValueError("포트폴리오가 비어 있습니다.")

    raw_weights = [max(0.0, float(x.get("weight", 0))) for x in portfolio]
    total_weight = sum(raw_weights)
    if total_weight <= 0:
        raise ValueError("포트폴리오 비중 합계가 0%입니다.")

    usdkrw, fx_source = fx_usdkrw()
    stats, assets = [], []
    for item, raw_w in zip(portfolio, raw_weights):
        ticker = str(item.get("ticker", "")).upper().strip()
        if not ticker:
            continue
        weight = raw_w / total_weight
        s = get_stats(ticker, allow_demo=True)
        currency = s.get("currency", "USD")
        if currency not in {"USD", "KRW"}:
            raise ValueError(f"{ticker}: MVP는 USD/KRW 종목만 지원합니다. 현재 통화: {currency}")
        fx = usdkrw if currency == "USD" else 1.0
        price = max(0.000001, float(s["price"]))
        price_krw = price * fx
        initial_value = initial * weight
        shares = initial_value / price_krw if price_krw > 0 else 0.0

        pg = item.get("priceGrowth")
        dg = item.get("distributionGrowth")
        price_growth = float(s.get("default_price_growth", 0.04)) if pg is None else max(-0.50, min(float(pg)/100.0, 0.50))
        dist_growth = float(s.get("default_distribution_growth", 0.02)) if dg is None else max(-0.50, min(float(dg)/100.0, 0.50))

        stat = dict(s)
        stat.update({"weight": weight, "price_krw": price_krw, "price_growth": price_growth, "distribution_growth": dist_growth})
        stats.append(stat)
        assets.append({
            "ticker": ticker, "weight": weight, "currency": currency, "fx": fx,
            "shares": shares, "price": price, "annual_dps": max(0.0, float(s.get("ttm_dps", 0.0))),
            "price_growth": price_growth, "distribution_growth": dist_growth,
            "cost_basis": initial_value,
        })
    if not assets:
        raise ValueError("유효한 종목이 없습니다.")

    contributed = initial
    cash = 0.0
    retired = False
    fire_month = None
    fire_assets = None
    fire_contributed = None
    post_fire_failure_month = None
    depleted_month = None
    cumulative_dividend_tax = 0.0
    cumulative_sale_tax = 0.0
    rows = []

    def calendar_year_for_month(month_index):
        total_calendar_month = (start_month - 1) + month_index
        return start_year + total_calendar_month // 12

    def scheduled_contribution(month_index):
        return contribution_schedule.get(calendar_year_for_month(month_index), monthly_contrib)

    def market_state(year):
        gross_foreign = gross_domestic = 0.0
        securities = foreign_assets = foreign_basis = total_basis = 0.0
        for a in assets:
            value = a["shares"] * a["price"] * a["fx"]
            securities += value
            total_basis += a["cost_basis"]
            gross_div = a["shares"] * a["annual_dps"] * a["fx"] / 12.0
            gross_div *= (1.0 - stress)
            if a["currency"] == "USD":
                gross_foreign += gross_div
                foreign_assets += value
                foreign_basis += a["cost_basis"]
            else:
                gross_domestic += gross_div
        gross_div = gross_foreign + gross_domestic
        annual_tax = annual_dividend_tax(gross_foreign*12, gross_domestic*12, other_income)
        div_tax = annual_tax / 12.0
        net_div = max(0.0, gross_div - div_tax)
        living_nominal = (fire_exp + health) * ((1 + inflation) ** year)
        side_income_nominal = post_fire_income * ((1 + inflation) ** year)
        required_from_portfolio = max(0.0, living_nominal - side_income_nominal)
        total_assets = securities + cash
        gross_capacity = total_assets * withdrawal_rate / 12.0
        # Capacity tax approximation: annualized sale at the n% rate, foreign-gain ratio applied.
        sale_tax_capacity = annual_sale_tax(gross_capacity*12, foreign_assets, foreign_basis) / 12.0
        net_capacity = max(0.0, gross_capacity - sale_tax_capacity)
        return {
            "securities": securities, "assets": total_assets, "basis": total_basis,
            "foreignAssets": foreign_assets, "foreignBasis": foreign_basis,
            "grossDividend": gross_div, "netDividend": net_div, "dividendTax": div_tax,
            "livingCost": living_nominal, "postFireIncome": side_income_nominal,
            "requiredFromPortfolio": required_from_portfolio,
            "grossWithdrawalCapacity": gross_capacity, "netWithdrawalCapacity": net_capacity,
            "withdrawalCapacityTax": sale_tax_capacity,
        }

    def fire_ready(st):
        if st["requiredFromPortfolio"] <= 0:
            return True
        if fire_mode == "dividend":
            return st["netDividend"] >= st["requiredFromPortfolio"]
        return st["netWithdrawalCapacity"] >= st["requiredFromPortfolio"]

    def buy(amount_krw):
        nonlocal contributed
        if amount_krw <= 0:
            return
        for a in assets:
            amt = amount_krw * a["weight"]
            unit = a["price"] * a["fx"]
            if unit > 0:
                a["shares"] += amt / unit
                a["cost_basis"] += amt

    def reinvest_amount(amount_krw):
        if amount_krw <= 0:
            return
        for a in assets:
            amt = amount_krw * a["weight"]
            unit = a["price"] * a["fx"]
            if unit > 0:
                a["shares"] += amt / unit
                a["cost_basis"] += amt

    def sell_securities(gross_sale):
        """Sell proportionally by market value. Returns actual gross sale."""
        remaining = max(0.0, gross_sale)
        securities = sum(a["shares"]*a["price"]*a["fx"] for a in assets)
        if securities <= 0 or remaining <= 0:
            return 0.0
        actual = min(remaining, securities)
        for a in assets:
            value = a["shares"]*a["price"]*a["fx"]
            if value <= 0:
                continue
            portion_sale = actual * (value / securities)
            frac = min(1.0, portion_sale / value)
            a["shares"] *= (1.0 - frac)
            a["cost_basis"] *= (1.0 - frac)
        return actual

    def row(month_index, st, phase, shortfall=0.0, sale=0.0, sale_tax=0.0, applied_contribution=0.0):
        total_calendar_month = (start_month - 1) + month_index
        calendar_year = start_year + total_calendar_month // 12
        calendar_month = total_calendar_month % 12 + 1
        age = current_age + month_index / 12.0
        return {
            "month": month_index, "year": round(month_index/12.0, 2), "phase": phase,
            "calendarYear": calendar_year, "calendarMonth": calendar_month, "age": round(age, 2),
            "assets": round(st["assets"]), "securities": round(st["securities"]), "cash": round(cash),
            "contributed": round(contributed), "monthlyContribution": round(applied_contribution), "grossDividend": round(st["grossDividend"]),
            "netDividend": round(st["netDividend"]), "dividendTax": round(st["dividendTax"]),
            "grossWithdrawal": round(st["grossWithdrawalCapacity"]), "netWithdrawal": round(st["netWithdrawalCapacity"]),
            "withdrawalTax": round(st["withdrawalCapacityTax"]), "livingCost": round(st["livingCost"]),
            "postFireIncome": round(st["postFireIncome"]), "requiredFromPortfolio": round(st["requiredFromPortfolio"]),
            "shortfall": round(shortfall), "actualSale": round(sale), "actualSaleTax": round(sale_tax),
        }

    # Initial snapshot / possible immediate FIRE.
    st0 = market_state(0)
    if fire_ready(st0):
        retired = True
        fire_month = 0
        fire_assets = st0["assets"]
        fire_contributed = contributed
    rows.append(row(0, st0, "FIRE" if retired else "ACCUMULATION", applied_contribution=0.0 if retired else scheduled_contribution(0)))

    for m in range(1, months+1):
        year = m/12.0
        # Market evolves first: NAV/price and annualized per-share distribution grow independently.
        for a in assets:
            a["price"] *= (1 + a["price_growth"]) ** (1/12)
            a["annual_dps"] *= (1 + a["distribution_growth"]) ** (1/12)

        if not retired:
            month_contrib = scheduled_contribution(m)
            if month_contrib > 0:
                buy(month_contrib)
                contributed += month_contrib
            st = market_state(year)
            cumulative_dividend_tax += st["dividendTax"]
            if reinvest:
                reinvest_amount(st["netDividend"])
            else:
                cash += st["netDividend"]
            st = market_state(year)
            if fire_ready(st):
                retired = True
                fire_month = m
                fire_assets = st["assets"]
                fire_contributed = contributed
            phase = "FIRE" if retired else "ACCUMULATION"
            if m % 3 == 0 or m == months:
                rows.append(row(m, st, phase, applied_contribution=month_contrib))
            continue

        # FIRE phase: no salary contributions. Dividends become spendable cash.
        st = market_state(year)
        cumulative_dividend_tax += st["dividendTax"]
        net_div = st["netDividend"]
        need = st["requiredFromPortfolio"]
        shortfall = 0.0
        sale = 0.0
        sale_tax = 0.0

        if fire_mode == "dividend":
            available = cash + net_div
            if available >= need:
                remainder = available - need
                cash = 0.0
                if reinvest and remainder > 0:
                    reinvest_amount(remainder)
                else:
                    cash = remainder
            else:
                shortfall = need - available
                cash = 0.0
                if post_fire_failure_month is None:
                    post_fire_failure_month = m
        else:
            # Dividends + existing cash first; sell principal only for the remaining living cost.
            available = cash + net_div
            if available >= need:
                cash = available - need
            else:
                remaining_need = need - available
                cash = 0.0
                pre = market_state(year)
                # Gross-up iteratively for estimated sale tax on an annualized sale amount.
                gross = remaining_need
                for _ in range(5):
                    annual_tax = annual_sale_tax(gross*12, pre["foreignAssets"], pre["foreignBasis"])
                    sale_tax = annual_tax/12.0
                    gross = remaining_need + sale_tax
                sale = sell_securities(gross)
                cumulative_sale_tax += sale_tax
                net_sale = max(0.0, sale - sale_tax)
                if net_sale + 1e-6 < remaining_need:
                    shortfall = remaining_need - net_sale
                    if depleted_month is None:
                        depleted_month = m
                    if post_fire_failure_month is None:
                        post_fire_failure_month = m

        st = market_state(year)
        if st["assets"] <= 1 and depleted_month is None:
            depleted_month = m
            if post_fire_failure_month is None:
                post_fire_failure_month = m
        if m % 3 == 0 or m == months:
            rows.append(row(m, st, "FIRE", shortfall, sale, sale_tax))

    final = market_state(years)
    weighted_yield = sum(s["yield"]*s["weight"] for s in stats)
    weighted_price_growth = sum(s["price_growth"]*s["weight"] for s in stats)
    # Distribution-growth weighted by current expected cash contribution, not capital weight alone.
    ysum = sum(s["yield"]*s["weight"] for s in stats)
    weighted_dist_growth = (sum(s["distribution_growth"]*s["yield"]*s["weight"] for s in stats)/ysum) if ysum > 0 else 0.0
    current_monthly_contrib = scheduled_contribution(0)
    monthly_surplus = monthly_income - fixed - current_monthly_contrib

    final_real_net_div = final["netDividend"] / ((1+inflation)**years) if (1+inflation) > 0 else final["netDividend"]
    final_real_required = final["requiredFromPortfolio"] / ((1+inflation)**years) if (1+inflation) > 0 else final["requiredFromPortfolio"]

    return {
        "rows": rows, "stats": stats, "fireMode": fire_mode, "withdrawalRate": withdrawal_rate,
        "currentAge": current_age, "startYear": start_year, "startMonth": start_month,
        "fireMonth": fire_month, "fireAssets": round(fire_assets) if fire_assets is not None else None,
        "fireContributed": round(fire_contributed) if fire_contributed is not None else None,
        "postFireFailureMonth": post_fire_failure_month, "depletedMonth": depleted_month,
        "finalAssets": round(final["assets"]), "finalCash": round(cash),
        "weightedYield": weighted_yield, "weightedPriceGrowth": weighted_price_growth,
        "weightedDistributionGrowth": weighted_dist_growth, "monthlySurplus": round(monthly_surplus),
        "currentMonthlyContribution": round(current_monthly_contrib),
        "contributionSchedule": {str(y): round(v) for y, v in sorted(contribution_schedule.items())},
        "currentNetDividend": round(st0["netDividend"]), "currentGrossDividend": round(st0["grossDividend"]),
        "currentNetWithdrawal": round(st0["netWithdrawalCapacity"]), "currentGrossWithdrawal": round(st0["grossWithdrawalCapacity"]),
        "finalNetDividend": round(final["netDividend"]), "finalGrossDividend": round(final["grossDividend"]),
        "finalNetWithdrawal": round(final["netWithdrawalCapacity"]), "finalGrossWithdrawal": round(final["grossWithdrawalCapacity"]),
        "currentNetCashflow": round(st0["netWithdrawalCapacity"] if fire_mode=="withdrawal" else st0["netDividend"]),
        "finalNetCashflow": round(final["netWithdrawalCapacity"] if fire_mode=="withdrawal" else final["netDividend"]),
        "finalLivingCost": round(final["livingCost"]), "finalRequiredFromPortfolio": round(final["requiredFromPortfolio"]),
        "finalRealNetDividend": round(final_real_net_div), "finalRealRequired": round(final_real_required),
        "cumulativeDividendTax": round(cumulative_dividend_tax), "cumulativeSaleTax": round(cumulative_sale_tax),
        "cumulativeTax": round(cumulative_dividend_tax + cumulative_sale_tax),
        "usdkrw": usdkrw, "fxSource": fx_source,
        "notes": [
            "v8.9.3은 그래프 hover에서 해당 시점의 명목금액과 현재가치(실질금액)를 함께 표시합니다.",
            "기본 월 적립금에 연도별 override를 적용하며, FIRE 도달 후에는 해당 연도 설정과 관계없이 월 적립을 0원으로 중단합니다.",
            "FIRE 전에는 월 적립과 선택적 배당 재투자를 하고, FIRE 도달 다음 달부터 월 적립을 중단합니다.",
            "배당생활 모드는 원금 매도 없이 배당·현금만 사용하고, 생활비 초과분만 선택적으로 재투자합니다.",
            "n% 인출 모드는 배당을 먼저 생활비에 쓰고 부족분만 자산 매도로 충당합니다.",
            "ETF별 가격 성장률과 분배금 성장률은 사용자 가정이며 미래 예측값이 아닙니다.",
            "세금·건보료는 계획용 간이 추정입니다.",
        ],
    }


def read_settings():
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_settings(data):
    if not isinstance(data, dict):
        raise ValueError("settings must be an object")
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode("utf-8")) > 128_000:
        raise ValueError("settings too large")
    tmp = SETTINGS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(raw)
    os.replace(tmp, SETTINGS_FILE)


_last_heartbeat = time.monotonic()
_seen_heartbeat = False
_heartbeat_lock = threading.Lock()
_server_ref = None

def touch_heartbeat():
    global _last_heartbeat, _seen_heartbeat
    with _heartbeat_lock:
        _last_heartbeat = time.monotonic()
        _seen_heartbeat = True

def idle_shutdown_watchdog():
    # Once the UI has actually loaded, shut down after 120 s with no heartbeat.
    # This keeps a browser-based desktop app from leaving an invisible process forever.
    while True:
        time.sleep(15)
        with _heartbeat_lock:
            seen = _seen_heartbeat
            idle = time.monotonic() - _last_heartbeat
        if seen and idle > 120 and _server_ref is not None:
            try:
                _server_ref.shutdown()
            except Exception:
                pass
            return

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Never let an old browser tab reuse stale JS/HTML from a previous build.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path):
        p = urlparse(path).path
        if p == "/": p = "/index.html"
        return os.path.join(STATIC, p.lstrip("/"))

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/heartbeat":
            touch_heartbeat(); self.send_json({"ok": True}); return
        if u.path == "/api/version":
            self.send_json({"version":"v8.9.3","build":"2026-09-19-v8.9.3-nominal-real-hover-1"})
            return
        if u.path == "/api/settings":
            self.send_json({"settings": read_settings()})
            return
        if u.path == "/api/ticker":
            q = parse_qs(u.query)
            ticker = (q.get("ticker") or [""])[0].upper().strip()
            if not ticker:
                self.send_json({"error":"티커를 입력해 주세요."}, 400); return
            try:
                out = get_stats(ticker, allow_demo=ticker in KNOWN_TICKERS)
                fx, fx_source = fx_usdkrw()
                out["price_krw"] = out["price"] * (fx if out.get("currency")=="USD" else 1.0)
                out["usdkrw"] = fx; out["fxSource"] = fx_source
                self.send_json(out)
            except Exception as e:
                self.send_json({"error":f"'{ticker}' 확인 실패: {e}"}, 404)
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            n = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(n) if n > 0 else b"{}"
            payload = json.loads(body.decode("utf-8"))
            if path == "/api/heartbeat":
                touch_heartbeat(); self.send_json({"ok": True}); return
            if path == "/api/quit":
                self.send_json({"ok": True})
                if _server_ref is not None:
                    threading.Thread(target=_server_ref.shutdown, daemon=True).start()
                return
            if path == "/api/settings":
                write_settings(payload)
                self.send_json({"ok": True})
                return
            if path == "/api/simulate":
                self.send_json(simulate(payload))
                return
            self.send_error(404)
        except Exception as e:
            self.send_json({"error":str(e)}, 400)

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.end_headers(); self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("[FIRE]", fmt % args)


def open_browser(port):
    time.sleep(1.0)
    webbrowser.open(f"http://127.0.0.1:{port}/?v=8.9.3-nominal-real-hover-1")


if __name__ == "__main__":
    try:
        preferred_port = int(os.environ.get("FIRE_PORT", "18880"))
    except ValueError:
        preferred_port = 18880

    # Keep the process working directory outside the app folder so Windows does not lock it.
    server = None
    port = None
    last_error = None
    for candidate in range(preferred_port, preferred_port + 20):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
            port = candidate
            break
        except OSError as e:
            last_error = e
    if server is None or port is None:
        raise RuntimeError(f"No free local port found ({preferred_port}-{preferred_port+19}): {last_error}")

    pid_file = PID_FILE
    try:
        with open(pid_file, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
    except OSError:
        pass

    _server_ref = server
    threading.Thread(target=idle_shutdown_watchdog, daemon=True).start()
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    print(f"Dividend FIRE Simulator v8.9.3 running at http://127.0.0.1:{port}/")
    if port != preferred_port:
        print(f"Port {preferred_port} was busy; using {port} instead.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            server.server_close()
        except Exception:
            pass
        try:
            if os.path.exists(pid_file):
                os.remove(pid_file)
        except OSError:
            pass
