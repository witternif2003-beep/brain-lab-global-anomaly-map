import Image from 'next/image';
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, AlertOctagon, ExternalLink, RefreshCw, Lock, Database } from 'lucide-react';

interface WantedItem {
  uid: string;
  title: string;
  subjects?: string[];
  field_offices?: string[];
  reward_min?: number;
  reward_text?: string;
  url: string;
  description?: string;
  images?: { thumb?: string; original?: string }[];
}

interface RestrictedDatabase {
  name: string;
  acronym: string;
  status: string;
  reason: string;
  url: string;
  statutoryBasis: string;
}

const RESTRICTED_DATABASES: RestrictedDatabase[] = [
  {
    name: 'National Crime Information Center',
    acronym: 'NCIC',
    status: 'RESTRICTED — LAW ENFORCEMENT ONLY',
    reason: 'Machine-to-machine only, not internet-accessible. NCIC is not web-based and is not available on the Internet.',
    url: 'https://www.fbi.gov/services/cjis/ncic',
    statutoryBasis: '28 U.S.C. § 534; 28 C.F.R. Part 20',
  },
  {
    name: 'Violent Criminal Apprehension Program',
    acronym: 'ViCAP',
    status: 'RESTRICTED — LAW ENFORCEMENT ONLY',
    reason: 'Requires LEEP credentials through CJIS; each user must obtain a verified LeepID.',
    url: 'https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-resources/cjis/cjis-services/law-enforcement-enterprise-portal-leep',
    statutoryBasis: 'FBI CJIS Security Policy Area 4',
  },
  {
    name: 'National Data Exchange',
    acronym: 'N-DEx',
    status: 'RESTRICTED — LAW ENFORCEMENT ONLY',
    reason: 'Law-enforcement-restricted; not publicly exposed to civilian web requests.',
    url: 'https://www.fbi.gov/services/cjis/ndex',
    statutoryBasis: '28 C.F.R. § 20.33',
  },
  {
    name: 'Criminal Justice Information Services Systems',
    acronym: 'CJIS',
    status: 'RESTRICTED — LAW ENFORCEMENT ONLY',
    reason: 'Authorized agencies only. Publicly accessible computers shall not be used to access CJI.',
    url: 'https://www.fbi.gov/services/cjis',
    statutoryBasis: 'CJIS Security Policy v5.9 § 5.5.1',
  },
  {
    name: 'National Incident-Based Reporting System (Raw Incidents)',
    acronym: 'NIBRS (Raw)',
    status: 'RESTRICTED — BULK CSV ONLY',
    reason: 'Bulk CSV downloads from CDE only; no live public streaming incident API exists.',
    url: 'https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/downloads',
    statutoryBasis: 'UCR Technical Specifications',
  },
  {
    name: 'FBI CJIS Biometric Center of Excellence & NGI',
    acronym: 'NGI / IAFIS',
    status: 'RESTRICTED — LAW ENFORCEMENT ONLY',
    reason: 'Next Generation Identification biometric records are federally protected CJI.',
    url: 'https://www.fbi.gov/services/cjis/fingerprints-and-other-biometrics/ngi',
    statutoryBasis: 'Privacy Act of 1974; 5 U.S.C. § 552a',
  },
  {
    name: 'Terrorist Screening Center Database',
    acronym: 'TSDB / TSC',
    status: 'RESTRICTED — CLASSIFIED / LAW ENFORCEMENT',
    reason: 'Consolidated terrorist watchlisting database; strictly restricted by National Security Presidential Directive.',
    url: 'https://www.fbi.gov/investigate/terrorism/tsc',
    statutoryBasis: 'HSPD-6; 49 U.S.C. § 114(h)',
  },
];

export default function FbiDataSection() {
  const [activeTab, setActiveTab] = useState<'LIVE' | 'RESTRICTED'>('LIVE');

  // FBI Wanted state
  const [wantedItems, setWantedItems] = useState<WantedItem[]>([]);
  const [wantedTotal, setWantedTotal] = useState<number | null>(null);
  const [wantedLoading, setWantedLoading] = useState<boolean>(true);
  const [wantedError, setWantedError] = useState<string | null>(null);
  const [wantedCategory, setWantedCategory] = useState<string>('all');

  // FBI Crime state
  const [crimeData, setCrimeData] = useState<any>(null);
  const [crimeLoading, setCrimeLoading] = useState<boolean>(true);
  const [crimeError, setCrimeError] = useState<string | null>(null);
  const [crimeLevel, setCrimeLevel] = useState<string>('national');
  const [crimeOffense, setCrimeOffense] = useState<string>('violent-crime');
  const [crimeFrom, setCrimeFrom] = useState<string>('01-2023');
  const [crimeTo, setCrimeTo] = useState<string>('12-2023');

  // Fetch Wanted API
  useEffect(() => {
    let cancelled = false;
    setWantedLoading(true);
    setWantedError(null);

    const query = new URLSearchParams();
    query.set('page', '1');
    if (wantedCategory !== 'all') {
      query.set('category', wantedCategory);
    }

    fetch(`/api/fbi/wanted?${query.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setWantedItems(data.items || []);
          setWantedTotal(data.total ?? 0);
          setWantedLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWantedError(err.message || 'Failed to fetch FBI Wanted data');
          setWantedLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [wantedCategory]);

  // Fetch Crime API
  useEffect(() => {
    let cancelled = false;
    setCrimeLoading(true);
    setCrimeError(null);

    const query = new URLSearchParams({
      level: crimeLevel,
      scope: crimeLevel === 'state' ? 'GA' : 'US',
      offense: crimeOffense,
      from: crimeFrom,
      to: crimeTo,
    });

    fetch(`/api/fbi/crime?${query.toString()}`)
      .then(async (res) => {
        if (res.status === 501) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'FBI_API_KEY not configured');
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setCrimeData(data);
          setCrimeLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCrimeError(err.message || 'Failed to fetch FBI Crime data');
          setCrimeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [crimeLevel, crimeOffense, crimeFrom, crimeTo]);

  return (
    <section className="w-full rounded-[36px] bg-[#080e1a]/85 backdrop-blur-2xl border border-[#38bdf8]/40 p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(56,189,248,0.35)] space-y-5 font-mono text-xs">
      {/* Header and Disclosure */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1e3a5f]/60 gap-3">
        <div className="flex items-center gap-3.5">
          {/* Official Federal Bureau of Investigation Conformal Seal */}
          <div
            className="relative shrink-0 rounded-full flex items-center justify-center p-0.5"
            style={{
              width: '46px',
              height: '46px',
              minWidth: '46px',
              minHeight: '46px',
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              border: '2px solid #38bdf8',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)',
              backgroundColor: '#030712',
              overflow: 'hidden'
            }}
          >
            <Image
              src="/assets/fbi-seal-official.png"
              alt="Official Seal of the Federal Bureau of Investigation"
              width={42}
              height={42}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                aspectRatio: '1 / 1',
                borderRadius: '50%',
              }}
              priority
            />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[#38bdf8] bg-[#0c2444] border border-[#38bdf8]/50 shadow-[0_0_8px_rgba(56,189,248,0.3)]">
                FBI CJIS / CDE PROTOCOL
              </span>
              <h2 className="text-xs sm:text-[13px] font-extrabold text-[#f8fafc] tracking-widest uppercase flex items-center gap-1.5">
                <span>FEDERAL BUREAU OF INVESTIGATION</span>
                <span className="text-[#38bdf8]">•</span>
                <span className="text-[#38bdf8]">DATABASE CAPABILITIES & LIVE FEEDS</span>
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-normal max-w-3xl">
              Live feeds from FBI Wanted API (no key) and FBI Crime Data Explorer API (free key, 1,000 req/hr). Restricted databases listed for transparency only — no data is fetched from them.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#0a1228] border border-[#1e3a5f] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('LIVE')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all ${
              activeTab === 'LIVE'
                ? 'bg-[#0c2444] text-[#38bdf8] border border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            LIVE FEEDS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('RESTRICTED')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all ${
              activeTab === 'RESTRICTED'
                ? 'bg-[#2b0808] text-[#f87171] border border-[#ff3b3b] shadow-[0_0_12px_rgba(255,59,59,0.5)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            RESTRICTED (7)
          </button>
        </div>
      </div>

      {/* TAB CONTENT: LIVE FEEDS */}
      {activeTab === 'LIVE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: FBI Most Wanted */}
          <div className="rounded-[28px] bg-[#0a1228]/85 backdrop-blur-xl border border-[#1e3a5f] hover:border-[#38bdf8]/60 p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-col space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#1e3a5f]/60 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-[#38bdf8] tracking-wider uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse" />
                  FBI MOST WANTED — LIVE
                </h3>
                <div className="text-[11px] text-slate-400 pt-0.5">
                  {wantedLoading ? (
                    'Connecting to api.fbi.gov...'
                  ) : wantedTotal !== null ? (
                    `${wantedTotal.toLocaleString()} records tracked`
                  ) : (
                    'Unavailable'
                  )}
                </div>
              </div>

              {/* Filter dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={wantedCategory}
                  onChange={(e) => setWantedCategory(e.target.value)}
                  className="bg-[#070d18] text-slate-300 text-[10px] font-mono border border-slate-800 rounded-full px-2.5 py-1 outline-none hover:border-slate-700 focus:border-[#38bdf8]"
                >
                  <option value="all">All Subjects</option>
                  <option value="Ten Most Wanted Fugitives">Ten Most Wanted</option>
                  <option value="Seeking Information">Seeking Information</option>
                  <option value="Kidnappings and Missing Persons">Kidnappings & Missing</option>
                  <option value="Criminal Enterprise Investigations">Criminal Enterprise</option>
                  <option value="Cyber's Most Wanted">Cyber's Most Wanted</option>
                </select>
              </div>
            </div>

            {/* List */}
            {wantedLoading ? (
              <div className="flex items-center justify-center p-8 text-[#38bdf8] animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                <span>FETCHING LIVE FBI WANTED STREAM...</span>
              </div>
            ) : wantedError ? (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs">
                Error: {wantedError}
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {wantedItems.slice(0, 10).map((item) => (
                  <a
                    key={item.uid}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block p-2.5 rounded-xl bg-[#070d18]/90 border border-slate-800/80 hover:border-[#38bdf8]/70 hover:bg-[#0c1a2e] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-white font-bold text-xs truncate group-hover:text-[#38bdf8] flex items-center gap-1.5">
                          <span>{item.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.subjects?.join(', ') || 'No subject classification'}
                        </div>
                        {item.field_offices && item.field_offices.length > 0 && (
                          <div className="text-[9px] text-[#38bdf8]/80 uppercase">
                            Field Office: {item.field_offices.join(', ')}
                          </div>
                        )}
                      </div>
                      {item.reward_min && item.reward_min > 0 ? (
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 font-bold">
                          Reward: ${item.reward_min.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: FBI Crime Data Explorer */}
          <div className="rounded-[28px] bg-[#0a1228]/85 backdrop-blur-xl border border-[#1e3a5f] hover:border-emerald-500/60 p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-col space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#1e3a5f]/60 pb-2.5 flex-wrap gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-[#34d399] tracking-wider uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                  FBI CRIME DATA EXPLORER — LIVE
                </h3>
                <div className="text-[11px] text-slate-400 pt-0.5">
                  Summarized CDE incidents • 1,000 req/hr allocation
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={crimeLevel}
                  onChange={(e) => setCrimeLevel(e.target.value)}
                  className="bg-[#070d18] text-slate-300 text-[10px] font-mono border border-slate-800 rounded-full px-2 py-1 outline-none hover:border-slate-700"
                >
                  <option value="national">National (US)</option>
                  <option value="state">Georgia (GA)</option>
                </select>

                <select
                  value={crimeOffense}
                  onChange={(e) => setCrimeOffense(e.target.value)}
                  className="bg-[#070d18] text-slate-300 text-[10px] font-mono border border-slate-800 rounded-full px-2 py-1 outline-none hover:border-slate-700"
                >
                  <option value="violent-crime">Violent Crime</option>
                  <option value="property-crime">Property Crime</option>
                  <option value="homicide">Homicide</option>
                  <option value="robbery">Robbery</option>
                  <option value="burglary">Burglary</option>
                  <option value="aggravated-assault">Aggravated Assault</option>
                </select>
              </div>
            </div>

            {/* Content or 501 Banner */}
            {crimeLoading ? (
              <div className="flex items-center justify-center p-8 text-emerald-400 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                <span>CONNECTING TO API.USA.GOV/CRIME/FBI/CDE...</span>
              </div>
            ) : crimeError ? (
              crimeError.includes('FBI_API_KEY not configured') ? (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-2 text-amber-400">
                    <AlertOctagon className="w-4 h-4" />
                    <span>FBI_API_KEY not configured. Add it in Vercel env settings.</span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 font-sans leading-relaxed">
                    Obtain a free key from <a href="https://api.data.gov/signup/" target="_blank" rel="noopener noreferrer" className="underline text-amber-300 hover:text-white">api.data.gov/signup</a>. Once provisioned, set the <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200">FBI_API_KEY</code> environment variable in Vercel to unlock real-time summarized national/state incident metrics.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs">
                  Error: {crimeError}
                </div>
              )
            ) : crimeData ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                <div className="p-3 rounded-xl bg-[#070d18] border border-slate-800 text-xs">
                  <pre className="text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(crimeData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB CONTENT: RESTRICTED */}
      {activeTab === 'RESTRICTED' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {RESTRICTED_DATABASES.map((db) => (
            <div
              key={db.acronym}
              className="rounded-[24px] bg-[#1a0808]/75 backdrop-blur-xl border border-rose-900/60 hover:border-rose-500/60 p-4 space-y-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-rose-400 tracking-wider">
                    {db.acronym}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-500/50 text-[9px] font-bold text-rose-300">
                    {db.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white tracking-wide">
                  {db.name}
                </h4>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  {db.reason}
                </p>
              </div>

              <div className="pt-2 border-t border-rose-950/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 truncate">{db.statutoryBasis}</span>
                <a
                  href={db.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-400 hover:text-white flex items-center gap-1 font-bold shrink-0 ml-2"
                >
                  <span>FBI Info</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
