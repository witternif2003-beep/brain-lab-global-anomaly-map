"""Build SEC EDGAR company profiles for the GA competitor markers.

Sources (public, keyless; SEC asks for a descriptive User-Agent):
  https://data.sec.gov/submissions/CIK##########.json      filer profile + filing index
  https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json  XBRL financial facts
Output: lib/ga-company-profiles.json

Balance sheet = instant facts from the most recent 10-K/10-Q; annual = duration facts (~1 year)
from the most recent 10-K. Total liabilities is only derived (liabilities-and-equity minus total
equity) when the filer does not tag `Liabilities` itself, and is flagged as derived.

Usage: python3 scripts/build-company-profiles.py
"""
import json
import time
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'lib' / 'ga-company-profiles.json'
UA = 'BrainLab research witternif2003@gmail.com'
CIKS = {
    'BAH': 1443646,
    'RTX': 101829,
    'CACI': 16058,
    'AMTM': 2011286,
    'KTOS': 1069258,
    'SAIC': 1571123,
    'DRS': 1833756,
    'MANT': 892537,
}
PERIODIC = ('10-K', '10-Q')
INSTANT = {
    'assets': ['Assets'],
    'liabilities': ['Liabilities'],
    'equity': ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'StockholdersEquity'],
    'liabilitiesAndEquity': ['LiabilitiesAndStockholdersEquity'],
    'cash': ['CashAndCashEquivalentsAtCarryingValue'],
    'longTermDebt': ['LongTermDebtNoncurrent'],
}
ANNUAL = {
    'revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
    'netIncome': ['NetIncomeLoss', 'ProfitLoss'],
}


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def filing_links(cik: int, accn: str, doc: str) -> dict:
    base = f'https://www.sec.gov/Archives/edgar/data/{cik}/{accn.replace("-", "")}'
    return {
        'docUrl': f'{base}/{doc}',
        'indexUrl': f'{base}/{accn}-index.htm',
        'viewerUrl': f'https://www.sec.gov/cgi-bin/viewer?action=view&cik={cik}&accession_number={accn}&xbrl_type=v',
    }


def pick(facts: dict, concepts: list, accn: str, annual: bool):
    for c in concepts:
        rows = [
            r for r in facts.get(c, {}).get('units', {}).get('USD', [])
            if r.get('accn') == accn and (('start' in r) == annual)
        ]
        if annual:
            rows = [
                r for r in rows
                if 350 <= (date.fromisoformat(r['end']) - date.fromisoformat(r['start'])).days <= 380
            ]
        if rows:
            return max(rows, key=lambda r: r['end'])
    return None


def main() -> None:
    out = {}
    for key, cik in CIKS.items():
        p = f'{cik:010d}'
        sub = get(f'https://data.sec.gov/submissions/CIK{p}.json')
        time.sleep(0.25)
        facts = get(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{p}.json')['facts'].get('us-gaap', {})
        time.sleep(0.25)
        r = sub['filings']['recent']
        filings = [
            {'form': r['form'][i], 'filed': r['filingDate'][i], 'accn': r['accessionNumber'][i],
             'doc': r['primaryDocument'][i], 'period': r['reportDate'][i]}
            for i in range(len(r['form']))
        ]
        latest = next(f for f in filings if f['form'] in PERIODIC)
        latest_k = next((f for f in filings if f['form'] == '10-K'), None)
        biz = sub['addresses']['business']

        bs = {'form': latest['form'], 'filed': latest['filed'], 'accn': latest['accn'],
              **filing_links(cik, latest['accn'], latest['doc'])}
        for field, concepts in INSTANT.items():
            row = pick(facts, concepts, latest['accn'], annual=False)
            if row:
                bs[field] = row['val']
                bs['periodEnd'] = max(bs.get('periodEnd', ''), row['end'])
        if 'liabilities' not in bs and 'liabilitiesAndEquity' in bs and 'equity' in bs:
            bs['liabilities'] = bs['liabilitiesAndEquity'] - bs['equity']
            bs['liabilitiesDerived'] = True
        bs.pop('liabilitiesAndEquity', None)

        annual = None
        if latest_k:
            annual = {'form': '10-K', 'filed': latest_k['filed'], 'accn': latest_k['accn'],
                      **filing_links(cik, latest_k['accn'], latest_k['doc'])}
            for field, concepts in ANNUAL.items():
                row = pick(facts, concepts, latest_k['accn'], annual=True)
                if row:
                    annual[field] = row['val']
                    annual['periodStart'] = row['start']
                    annual['periodEnd'] = row['end']

        out[key] = {
            'cik': cik,
            'name': sub['name'],
            'tickers': sub.get('tickers', []),
            'exchanges': sub.get('exchanges', []),
            'industry': sub.get('sicDescription', ''),
            'incorporated': sub.get('stateOfIncorporation', ''),
            'hq': f"{biz.get('city', '').title()}, {biz.get('stateOrCountry', '')}",
            'fiscalYearEnd': sub.get('fiscalYearEnd', ''),
            'edgarUrl': f'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K&dateb=&owner=include&count=40',
            'lastPeriodicFiling': latest['filed'],
            'balanceSheet': bs,
            'annual': annual,
        }
        print(key, sub['name'], bs.get('periodEnd'), bs.get('assets'), annual and annual.get('revenue'))

    OUT.write_text(json.dumps({
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'SEC EDGAR submissions and XBRL companyfacts APIs (data.sec.gov)',
        'companies': out,
    }, indent=1) + '\n')


if __name__ == '__main__':
    main()
