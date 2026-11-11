"""Build public company profiles for the GA competitor markers.

Sources (public, keyless; SEC asks for a descriptive User-Agent):
  https://data.sec.gov/submissions/CIK##########.json      filer profile + filing index
  https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json  XBRL financial facts
  https://api.usaspending.gov/api/v2/recipient/<id>/        federal award recipient profile
  https://api.usaspending.gov/api/v2/search/...             awarding agencies + largest contracts
  https://www.google.com/s2/favicons?domain=<domain>        site icon published by each company domain
Output: lib/ga-company-profiles.json, public/logos/<domain>.png

USAspending recipient ids were matched by legal name (parent level) and checked against the
listed city/state where USAspending has one; entities with no confident match are omitted.

Balance sheet = instant facts from the most recent 10-K/10-Q; annual = duration facts (~1 year)
from the most recent 10-K. Total liabilities is only derived (liabilities-and-equity minus total
equity) when the filer does not tag `Liabilities` itself, and is flagged as derived.

Usage: python3 scripts/build-company-profiles.py
"""
import json
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'lib' / 'ga-company-profiles.json'
LOGO_DIR = ROOT / 'public' / 'logos'
USASPENDING = 'https://api.usaspending.gov/api/v2'
FY_START, FY_END = '2025-10-01', '2026-09-30'
AWARDS_FROM = '2021-10-01'
CONTRACT_CODES = ['A', 'B', 'C', 'D']
FED = {
    'BAH': 'ed02855e-60d7-2540-e3d7-18fba1dd1316-P',
    'KTOS': '6ed33a3b-1910-7875-9717-c4b6701f032b-P',
    'RTX': 'bb947c1e-56f7-2f71-34d9-b0240c8b117c-P',
    'CACI': '5eb76328-ceeb-571b-5efe-569794c9c9b8-P',
    'CNS': '3c1a340d-2613-1609-93ce-eb1aba0559b5-P',
    'AMTM': 'be555dcf-9195-a54a-e0a9-3592392d69d7-P',
    'NEWSAT': 'e1372092-b383-7d0c-5495-97bd9f5e60d2-P',
    'CELESTAR': 'c8aecf0c-ca20-9bff-7662-f33c867b4902-P',
    'AITC': 'ef07cb92-13c4-ab9a-d22c-a085022d9781-P',
    'SAS': '4aa32dfb-d986-43ae-6db6-9d1e4ae9aec5-P',
    'DRS': 'f73d6fc6-be43-2ae0-0cfb-4586e0c5a1f8-P',
    'SAIC': '20af0683-f17d-1f8f-38ee-2f11bd124559-P',
    'MANT': '4c1f7ae7-7f7d-43c4-d9b7-e5fb262d6c93-P',
    'BAE': '52cf2be8-e3c8-df10-444c-4b5064fa9e30-P',
    'ADAPT': 'e9937814-09ba-0254-57ca-3bd7c1f27999-P',
    'SERCO': 'e21c9479-46c2-e775-fac8-12bcb5ad9d4c-P',
}
LOGO_DOMAINS = [
    'boozallen.com', 'kratosdefense.com', 'rtx.com', 'caci.com', 'cns-llc.us', 'amentum.com',
    'newsatnorthamerica.com', 'celestarcorp.com', 'aitc-llc.com', 'sas.com', 'vtgdefense.com',
    'leonardodrs.com', 'saic.com', 'mantech.com', 'baesystems.com', 'adaptforward.com', 'serco.com',
]
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
    'currentAssets': ['AssetsCurrent'],
    'currentLiabilities': ['LiabilitiesCurrent'],
    'goodwill': ['Goodwill'],
}
ANNUAL = {
    'revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
    'operatingIncome': ['OperatingIncomeLoss'],
    'netIncome': ['NetIncomeLoss', 'ProfitLoss'],
    'operatingCashFlow': ['NetCashProvidedByUsedInOperatingActivities'],
}
RECENT_FORMS = ('10-K', '10-Q', '8-K', 'DEF 14A')


def get(url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    headers = {'User-Agent': UA, **({'Content-Type': 'application/json'} if data else {})}
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(url)


def federal(rid: str) -> dict:
    latest = get(f'{USASPENDING}/recipient/{rid}/?year=latest')
    lifetime = get(f'{USASPENDING}/recipient/{rid}/?year=all')
    agencies = get(f'{USASPENDING}/search/spending_by_category/awarding_agency/', {
        'filters': {'recipient_id': rid, 'time_period': [{'start_date': FY_START, 'end_date': FY_END}]},
        'limit': 3,
    })['results']
    awards = get(f'{USASPENDING}/search/spending_by_award/', {
        'filters': {'recipient_search_text': [latest['name']], 'award_type_codes': CONTRACT_CODES,
                    'time_period': [{'start_date': AWARDS_FROM, 'end_date': FY_END}]},
        'fields': ['Award ID', 'Description', 'Award Amount', 'Awarding Agency', 'Start Date', 'End Date', 'Recipient Name'],
        'sort': 'Award Amount', 'order': 'desc', 'limit': 3,
    })['results']
    loc = latest.get('location') or {}
    return {
        'recipientId': rid,
        'name': latest['name'],
        'uei': latest.get('uei'),
        'parentName': latest.get('parent_name'),
        'city': (loc.get('city_name') or '').title(),
        'state': loc.get('state_code') or '',
        'businessTypes': latest.get('business_types') or [],
        'last12mObligations': latest.get('total_transaction_amount'),
        'last12mTransactions': latest.get('total_transactions'),
        'lifetimeObligations': lifetime.get('total_transaction_amount'),
        'lifetimeTransactions': lifetime.get('total_transactions'),
        'fy2026TopAgencies': [{'name': a['name'], 'amount': a['amount']} for a in agencies if a.get('amount', 0) > 0],
        'largestContracts': [{
            'id': a['Award ID'], 'description': (a.get('Description') or '').strip(), 'amount': a['Award Amount'],
            'agency': a['Awarding Agency'], 'start': a['Start Date'], 'end': a['End Date'],
            'recipient': a['Recipient Name'],
            'url': f"https://www.usaspending.gov/award/{a['generated_internal_id']}",
        } for a in awards],
        'profileUrl': f'https://www.usaspending.gov/recipient/{rid}/latest',
    }


def fetch_logos() -> dict:
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    out = {}
    for d in LOGO_DOMAINS:
        req = urllib.request.Request(f'https://www.google.com/s2/favicons?domain={d}&sz=128', headers={'User-Agent': UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                (LOGO_DIR / f'{d}.png').write_bytes(r.read())
            out[d] = f'/logos/{d}.png'
        except urllib.error.HTTPError:
            print('no site icon for', d)
    return out


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
        all_facts = get(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{p}.json')['facts']
        facts = all_facts.get('us-gaap', {})
        dei = all_facts.get('dei', {})
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
        shares = max(dei.get('EntityCommonStockSharesOutstanding', {}).get('units', {}).get('shares', []),
                     key=lambda x: x['end'], default=None)
        recent = [
            {'form': f['form'], 'filed': f['filed'], 'url': filing_links(cik, f['accn'], f['doc'])['docUrl']}
            for f in filings if f['form'] in RECENT_FORMS
        ][:6]

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
            'sic': sub.get('sic', ''),
            'ein': sub.get('ein', ''),
            'filerCategory': sub.get('category', ''),
            'phone': sub.get('phone', ''),
            'street': ' '.join(x for x in (biz.get('street1'), biz.get('street2')) if x).title(),
            'formerNames': [f"{n['name']} (until {n['to'][:10]})" for n in sub.get('formerNames', [])][:3],
            'sharesOutstanding': shares and {'value': shares['val'], 'asOf': shares['end']},
            'recentFilings': recent,
            'edgarUrl': f'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K&dateb=&owner=include&count=40',
            'lastPeriodicFiling': latest['filed'],
            'balanceSheet': bs,
            'annual': annual,
        }
        print(key, sub['name'], bs.get('periodEnd'), bs.get('assets'), annual and annual.get('revenue'))

    fed = {}
    for key, rid in FED.items():
        fed[key] = federal(rid)
        print(key, fed[key]['name'], fed[key]['last12mObligations'])

    OUT.write_text(json.dumps({
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'SEC EDGAR submissions and XBRL companyfacts APIs (data.sec.gov); USAspending.gov API v2',
        'companies': out,
        'federal': fed,
        'logos': fetch_logos(),
    }, indent=1) + '\n')


if __name__ == '__main__':
    main()
