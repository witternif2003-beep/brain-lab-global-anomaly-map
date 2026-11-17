import type { ElectionOffice } from "./types";

/**
 * Official election-office URL for each of the 56 jurisdictions, pinned from
 * the USA.gov "State and local election offices" directory (GSA). The live
 * directory is re-read on every ops run (see directory-drift.ts) so a change
 * on USA.gov shows up as drift instead of silently going stale.
 */
export const ELECTION_OFFICE_DIRECTORY = {
  id: "usagov-state-election-office",
  publisher: "USA.gov (U.S. General Services Administration)",
  url: "https://www.usa.gov/state-election-office",
  pinnedAt: "2026-09-28"
} as const;

type Row = [code: string, name: string, type: ElectionOffice["type"], url: string, extraAliases?: string[]];

const ROWS: Row[] = [
  ["AL", "Alabama", "state", "https://www.sos.alabama.gov/alabama-votes"],
  ["AK", "Alaska", "state", "https://www.elections.alaska.gov/"],
  ["AZ", "Arizona", "state", "https://azsos.gov/elections"],
  ["AR", "Arkansas", "state", "https://www.sos.arkansas.gov/elections"],
  ["CA", "California", "state", "https://www.sos.ca.gov/elections"],
  ["CO", "Colorado", "state", "https://www.sos.state.co.us/pubs/elections/main.html"],
  ["CT", "Connecticut", "state", "https://portal.ct.gov/sots/common-elements/v5-template---redesign/elections--voting--home-page"],
  ["DE", "Delaware", "state", "https://elections.delaware.gov/index.shtml"],
  ["DC", "District of Columbia", "district", "https://dcboe.org/", ["DC Board of Elections"]],
  ["FL", "Florida", "state", "https://www.dos.myflorida.com/elections/"],
  ["GA", "Georgia", "state", "https://sos.ga.gov/elections-division-georgia-secretary-states-office"],
  ["HI", "Hawaii", "state", "https://elections.hawaii.gov/", ["Hawaiʻi"]],
  ["ID", "Idaho", "state", "https://voteidaho.gov/"],
  ["IL", "Illinois", "state", "https://www.elections.il.gov/"],
  ["IN", "Indiana", "state", "https://indianavoters.in.gov/"],
  ["IA", "Iowa", "state", "https://sos.iowa.gov/elections/voterinformation/index.html"],
  ["KS", "Kansas", "state", "https://sos.ks.gov/elections/elections.html"],
  ["KY", "Kentucky", "state", "https://elect.ky.gov/Pages/default.aspx"],
  ["LA", "Louisiana", "state", "https://www.sos.la.gov/ElectionsAndVoting/Pages/default.aspx"],
  ["ME", "Maine", "state", "https://www.maine.gov/sos/cec/elec/index.html"],
  ["MD", "Maryland", "state", "https://elections.maryland.gov/"],
  ["MA", "Massachusetts", "state", "https://www.sec.state.ma.us/divisions/elections/elections-and-voting.htm"],
  ["MI", "Michigan", "state", "https://www.michigan.gov/sos/elections"],
  ["MN", "Minnesota", "state", "https://www.sos.state.mn.us/elections-voting/"],
  ["MS", "Mississippi", "state", "https://www.sos.ms.gov/elections-voting"],
  ["MO", "Missouri", "state", "https://www.sos.mo.gov/elections/"],
  ["MT", "Montana", "state", "https://sosmt.gov/elections/"],
  ["NE", "Nebraska", "state", "https://www.nebraska.gov/featured/elections-voting/"],
  ["NV", "Nevada", "state", "https://www.nvsos.gov/sos/elections"],
  ["NH", "New Hampshire", "state", "https://www.sos.nh.gov/elections/voters"],
  ["NJ", "New Jersey", "state", "https://www.nj.gov/state/elections/vote.shtml"],
  ["NM", "New Mexico", "state", "https://www.sos.nm.gov/voting-and-elections/voter-information-portal-nmvote-org/"],
  ["NY", "New York", "state", "https://www.elections.ny.gov/"],
  ["NC", "North Carolina", "state", "https://www.ncsbe.gov/"],
  ["ND", "North Dakota", "state", "https://vip.sos.nd.gov/PortalList.aspx"],
  ["OH", "Ohio", "state", "https://www.sos.state.oh.us/elections/voters/"],
  ["OK", "Oklahoma", "state", "https://oklahoma.gov/elections.html"],
  ["OR", "Oregon", "state", "https://sos.oregon.gov/voting-elections/Pages/default.aspx"],
  ["PA", "Pennsylvania", "state", "https://www.dos.pa.gov/VotingElections/Pages/default.aspx"],
  ["RI", "Rhode Island", "state", "https://vote.sos.ri.gov/"],
  ["SC", "South Carolina", "state", "https://www.scvotes.org/"],
  ["SD", "South Dakota", "state", "https://sdsos.gov/elections-voting/default.aspx"],
  ["TN", "Tennessee", "state", "https://sos.tn.gov/elections"],
  ["TX", "Texas", "state", "https://www.sos.state.tx.us/elections/index.shtml"],
  ["UT", "Utah", "state", "https://vote.utah.gov/"],
  ["VT", "Vermont", "state", "https://sos.vermont.gov/elections/"],
  ["VA", "Virginia", "state", "https://www.elections.virginia.gov/"],
  ["WA", "Washington", "state", "https://www.sos.wa.gov/elections"],
  ["WV", "West Virginia", "state", "https://sos.wv.gov/elections/pages/default.aspx"],
  ["WI", "Wisconsin", "state", "https://myvote.wi.gov/en-us/"],
  ["WY", "Wyoming", "state", "https://sos.wyo.gov/Elections/Default.aspx"],
  ["PR", "Puerto Rico", "territory", "https://ww2.ceepur.org/", ["Comisión Estatal de Elecciones", "CEE"]],
  ["VI", "U.S. Virgin Islands", "territory", "https://vivote.gov/", ["Virgin Islands"]],
  ["GU", "Guam", "territory", "https://gec.guam.gov/", ["Guam Election Commission"]],
  ["AS", "American Samoa", "territory", "https://aselectionoffice.gov/"],
  ["MP", "Northern Mariana Islands", "territory", "https://www.votecnmi.gov.mp/", ["Northern Mariana", "CNMI"]]
];

export const ELECTION_OFFICES: ElectionOffice[] = ROWS.map(([code, name, type, url, extra]) => ({
  code,
  name,
  type,
  url,
  aliases: [name, ...(extra ?? [])]
}));

export const ELECTION_OFFICE_BY_CODE = new Map(ELECTION_OFFICES.map((o) => [o.code, o]));
