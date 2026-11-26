/**
 * Latest 2026 statewide registration counts published by each jurisdiction's own
 * election office, read from the linked official report on 2026-09-28.
 *
 * Only the metric the report states is filled: `total` is all registered voters,
 * `active` is active-status only, `inactive` is inactive/suspense. A null field means
 * the report does not publish that figure; nothing is derived from other metrics.
 * `asOf` is the report's own as-of date (YYYY-MM-DD) or reporting month (YYYY-MM).
 * Jurisdictions absent here had no 2026 statewide count that could be read from an
 * official source; their cards fall back to the EAVS 2024 baseline.
 */
export interface Registration2026 {
  publisher: string;
  url: string;
  asOf: string;
  total: number | null;
  active: number | null;
  inactive: number | null;
  measure?: string;
}

export const REGISTRATION_2026_RETRIEVED = "2026-09-28";

export const REGISTRATION_2026: Record<string, Registration2026> = {
  AL: { publisher: "Alabama Secretary of State", url: "https://www.sos.alabama.gov/sites/default/files/election-data/2026-08/ALVR-2026.xlsx", asOf: "2026-07", total: 3822845, active: 3349543, inactive: 473302 },
  AK: { publisher: "Alaska Division of Elections", url: "https://www.elections.alaska.gov/statistics/2026/SEP/VOTERS%20BY%20PARTY%20AND%20PRECINCT.htm", asOf: "2026-09-03", total: 603310, active: null, inactive: null },
  AZ: { publisher: "Arizona Secretary of State", url: "https://azsos.gov/elections/results-data/voter-registration-statistics", asOf: "2026-07", total: 4306554, active: null, inactive: null, measure: "July 2026 (primary) registration report" },
  AR: { publisher: "Arkansas Secretary of State", url: "https://www.sos.arkansas.gov/uploads/elections/VR_7-17-26.pdf", asOf: "2026-07-17", total: 1831054, active: null, inactive: null, measure: "registrants eligible to vote" },
  CA: { publisher: "California Secretary of State", url: "https://www.sos.ca.gov/elections/report-registration/15day-primary-2026", asOf: "2026-05-18", total: 23155447, active: null, inactive: null, measure: "15-day Report of Registration for the June 2, 2026 primary" },
  CO: { publisher: "Colorado Secretary of State", url: "https://www.sos.state.co.us/pubs/elections/VoterRegNumbers/2026/AugustStatistics2026.xlsx", asOf: "2026-09-01", total: 4583227, active: 4006449, inactive: 576778, measure: "active + inactive (excludes 119,009 pre-registered)" },
  DE: { publisher: "Delaware Department of Elections", url: "https://elections.delaware.gov/voter/registrationtotals/pdfs/vrt_SD20260901.csv", asOf: "2026-09-01", total: 806530, active: null, inactive: null, measure: "sum of all election-district rows" },
  DC: { publisher: "D.C. Board of Elections", url: "https://dcboe.org/getContentAsset/48015446-2029-4371-8f6a-2c158832b500/5ebbd046-860b-4ee1-81c8-43d0e3bc446e/Data-Statistics-Report-8_2026.pdf?language=en", asOf: "2026-08-31", total: 449417, active: null, inactive: null },
  FL: { publisher: "Florida Department of State", url: "https://dos.fl.gov/elections/data-statistics/voter-registration-statistics/voter-registration-reports/voter-registration-by-party-affiliation/", asOf: "2026-08-31", total: null, active: 13580124, inactive: null },
  HI: { publisher: "Hawaii Office of Elections", url: "https://elections.hawaii.gov/wp-content/uploads/STATEWIDE-Summary-8-9-2026-08-14-57-AM.pdf", asOf: "2026-08-08", total: 846543, active: null, inactive: null, measure: "total registration at the August 8, 2026 primary" },
  ID: { publisher: "Idaho Secretary of State", url: "https://sos.idaho.gov/elections-division/voter-registration-totals/", asOf: "2026-02-02", total: 1021711, active: null, inactive: null },
  KS: { publisher: "Kansas Secretary of State", url: "https://kssos.org/elections/vr-statistics/2026/2026-Cumulative-Monthly-Voter-Registration-Numbers.xlsx", asOf: "2026-05-01", total: 2008874, active: null, inactive: null },
  KY: { publisher: "Kentucky State Board of Elections", url: "https://elect.ky.gov/Resources/Documents/voterstatscounty-August%202026.pdf", asOf: "2026-08", total: 3381901, active: null, inactive: null },
  ME: { publisher: "Maine Secretary of State", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/Reg%20%26%20Enr%20as%20of%2001-01-26%20pdf%20%28A%29.pdf", asOf: "2026-01-01", total: null, active: 1038603, inactive: null },
  MD: { publisher: "Maryland State Board of Elections", url: "https://elections.maryland.gov/pdf/vrar/2026/MSR-2026_08.pdf", asOf: "2026-08", total: 4611059, active: 4322671, inactive: 288388 },
  MI: { publisher: "Michigan Department of State", url: "https://mvic.sos.state.mi.us/VoterCount/Index", asOf: "2026-09-28", total: 8348125, active: null, inactive: null, measure: "daily Michigan Voter Count dashboard, read 2026-09-28" },
  NE: { publisher: "Nebraska Secretary of State", url: "https://sos.nebraska.gov/sites/default/files/doc/elections/vrstats/2026VR/Statewide-September-2026.pdf", asOf: "2026-09-01", total: 1258669, active: null, inactive: null, measure: "voters eligible to vote" },
  NV: { publisher: "Nevada Secretary of State", url: "https://www.nvsos.gov/Home/Components/News/News/3728/23", asOf: "2026-03", total: null, active: 2040752, inactive: null, measure: "March 2026 monthly report" },
  NH: { publisher: "New Hampshire Secretary of State", url: "https://www.sos.nh.gov/party-registration-history-1970-2026", asOf: "2026-08-03", total: 898860, active: null, inactive: null },
  NJ: { publisher: "New Jersey Division of Elections", url: "https://www.nj.gov/state/elections/assets/pdf/svrs-reports/2026/2026-09-voter-registration-by-county.pdf", asOf: "2026-09-01", total: 6709471, active: null, inactive: null },
  NC: { publisher: "North Carolina State Board of Elections", url: "https://vt.ncsbe.gov/RegStat/Results/?date=09%2F26%2F2026", asOf: "2026-09-26", total: 7860992, active: null, inactive: null },
  OK: { publisher: "Oklahoma State Election Board", url: "https://oklahoma.gov/content/dam/ok/en/elections/voter-registration-statistics/2026-vr-statistics/2026-05-31_vrstats-county.pdf", asOf: "2026-05-31", total: 2422573, active: null, inactive: null },
  OR: { publisher: "Oregon Secretary of State", url: "https://sos.oregon.gov/elections/Documents/Registration/2026-August.pdf", asOf: "2026-08", total: 3076893, active: null, inactive: null },
  PA: { publisher: "Pennsylvania Department of State", url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/voting-and-election-statistics/voter-registration-statistics/certified%20voter%20registration%20stats%20general%20primary%202026%20-%20final.pdf", asOf: "2026-05-19", total: 8956108, active: null, inactive: null, measure: "certified registration for the May 19, 2026 primary" },
  RI: { publisher: "Rhode Island Department of State", url: "https://elections.ri.gov/sites/g/files/xkgbur756/files/2026-09/Prim26_Summary.pdf", asOf: "2026-09-09", total: 791321, active: null, inactive: null, measure: "registered voters at the September 9, 2026 primary" },
  SD: { publisher: "South Dakota Secretary of State", url: "https://sdsos.gov/elections-voting/upcoming-elections/voter-registration-totals/2026%20Voter%20Registration/StatewideVotersByCounty_9.1.2026.pdf", asOf: "2026-09-01", total: 680664, active: 624667, inactive: 55997 },
  TN: { publisher: "Tennessee Secretary of State", url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/RptSixMonthSumJune2026.pdf", asOf: "2026-06-01", total: 4732385, active: 3984300, inactive: 748085 },
  TX: { publisher: "Texas Secretary of State", url: "https://www.sos.state.tx.us/elections/historical/mar2026.shtml", asOf: "2026-03", total: 18657918, active: null, inactive: null, measure: "registration for the March 3, 2026 primary, including 1,228,918 voters on the suspense list" },
  UT: { publisher: "Utah Lieutenant Governor's Office", url: "https://vote.utah.gov/current-voter-registration-statistics/", asOf: "2026-09-21", total: 2084181, active: 1778111, inactive: 306069 },
  VT: { publisher: "Vermont Secretary of State", url: "https://sos.vermont.gov/elections/voters/registration/vermont-voter-registration-data", asOf: "2026-08", total: 501127, active: null, inactive: null, measure: "voters on town checklists, including challenged status" },
  VA: { publisher: "Virginia Department of Elections", url: "https://www.elections.virginia.gov/resultsreports/registration-statistics/", asOf: "2026-09-01", total: 6450247, active: null, inactive: null },
  WA: { publisher: "Washington Secretary of State", url: "https://www.sos.wa.gov/sites/default/files/2026-07/PrimaryElectionFacts2026.pdf", asOf: "2026-07-01", total: null, active: 5132328, inactive: null },
  WI: { publisher: "Wisconsin Elections Commission", url: "https://elections.wi.gov/resources/statistics/september-1-2026-voter-registration-statistics", asOf: "2026-09-01", total: null, active: 3618602, inactive: null },
  WY: { publisher: "Wyoming Secretary of State", url: "https://sos.wyo.gov/Elections/Docs/VRStats/2026/26SepVR_Stats.pdf", asOf: "2026-09-01", total: 278468, active: null, inactive: null },
  MP: { publisher: "CNMI Commission on Elections", url: "https://votecnmi.gov.mp/voter/voter-reg-stats.php", asOf: "2026-08-12", total: 18022, active: null, inactive: null },
  VI: { publisher: "Election System of the Virgin Islands", url: "https://vivote.gov/wp-content/uploads/2026/09/Active-Voters-Statistics-as-September-4-2026.pdf", asOf: "2026-09-04", total: 57341, active: 31573, inactive: 25768 }
};
