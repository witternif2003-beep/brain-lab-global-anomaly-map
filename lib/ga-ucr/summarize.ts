/** Descriptive summaries of FBI CDE statewide summarized-offense responses. No adjustment, imputation or modelling. */

export interface CdeSummarized {
  offenses: {
    rates: Record<string, Record<string, number | null>>;
    actuals: Record<string, Record<string, number | null>>;
  };
  tooltips: { 'Percent of Population Coverage': Record<string, Record<string, number | null>> };
  populations: { population: Record<string, Record<string, number | null>> };
  cde_properties?: { max_data_date?: Record<string, string>; last_refresh_date?: Record<string, string> };
}

export interface MonthRow {
  month: string;
  offenses: number;
  clearances: number | null;
  ratePer100k: number | null;
  coveragePct: number | null;
}

export interface PeriodSummary {
  year: number;
  months: number;
  firstMonth: string;
  lastMonth: string;
  offenses: number;
  clearances: number | null;
  coverageMinPct: number | null;
  coverageMaxPct: number | null;
}

export interface OffenseSummary {
  offense: string;
  months: MonthRow[];
  completeYears: PeriodSummary[];
  /** Percent change in summed monthly counts between consecutive complete calendar years; null if the base is 0. */
  yearOverYear: { from: number; to: number; pctChange: number | null }[];
  partial: { current: PeriodSummary; priorSamePeriod: PeriodSummary | null } | null;
  warnings: string[];
}

const MONTH_KEY = /^(0[1-9]|1[0-2])-(\d{4})$/;

function sortKey(m: string): string {
  const [mm, yyyy] = m.split('-');
  return `${yyyy}-${mm}`;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function monthRows(raw: CdeSummarized, place: string, warnings: string[]): MonthRow[] {
  const counts = raw.offenses.actuals[`${place} Offenses`];
  if (!counts) throw new Error(`missing "${place} Offenses" actuals`);
  const clear = raw.offenses.actuals[`${place} Clearances`] ?? {};
  const rates = raw.offenses.rates[`${place} Offenses`] ?? {};
  const coverage = raw.tooltips['Percent of Population Coverage']?.[place] ?? {};
  const rows: MonthRow[] = [];
  for (const [month, value] of Object.entries(counts)) {
    if (!MONTH_KEY.test(month)) {
      warnings.push(`unexpected period key "${month}" ignored`);
      continue;
    }
    const offenses = num(value);
    if (offenses === null) continue;
    rows.push({ month, offenses, clearances: num(clear[month]), ratePer100k: num(rates[month]), coveragePct: num(coverage[month]) });
  }
  return rows.sort((a, b) => sortKey(a.month).localeCompare(sortKey(b.month)));
}

function period(year: number, rows: MonthRow[]): PeriodSummary {
  const cov = rows.map((r) => r.coveragePct).filter((v): v is number => v !== null);
  const cleared = rows.every((r) => r.clearances !== null);
  return {
    year,
    months: rows.length,
    firstMonth: rows[0].month,
    lastMonth: rows[rows.length - 1].month,
    offenses: rows.reduce((n, r) => n + r.offenses, 0),
    clearances: cleared ? rows.reduce((n, r) => n + (r.clearances ?? 0), 0) : null,
    coverageMinPct: cov.length ? Math.min(...cov) : null,
    coverageMaxPct: cov.length ? Math.max(...cov) : null,
  };
}

export function pctChange(from: number, to: number): number | null {
  return from === 0 ? null : ((to - from) / from) * 100;
}

export function summarizeOffense(offense: string, raw: CdeSummarized, place = 'Georgia'): OffenseSummary {
  const warnings: string[] = [];
  const months = monthRows(raw, place, warnings);
  const byYear = new Map<number, MonthRow[]>();
  for (const r of months) {
    const y = Number(r.month.slice(3));
    byYear.set(y, [...(byYear.get(y) ?? []), r]);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const completeYears = years.filter((y) => byYear.get(y)!.length === 12).map((y) => period(y, byYear.get(y)!));
  const yearOverYear = completeYears.slice(1).map((p, i) => ({
    from: completeYears[i].year,
    to: p.year,
    pctChange: pctChange(completeYears[i].offenses, p.offenses),
  }));
  let partial: OffenseSummary['partial'] = null;
  const last = years[years.length - 1];
  if (last !== undefined && byYear.get(last)!.length < 12) {
    const current = byYear.get(last)!;
    const wanted = new Set(current.map((r) => r.month.slice(0, 2)));
    const prior = (byYear.get(last - 1) ?? []).filter((r) => wanted.has(r.month.slice(0, 2)));
    partial = {
      current: period(last, current),
      priorSamePeriod: prior.length === current.length ? period(last - 1, prior) : null,
    };
    warnings.push(`${last} is partial (${current.length} of 12 months published); not compared as a year-over-year change`);
  }
  return { offense, months, completeYears, yearOverYear, partial, warnings };
}
