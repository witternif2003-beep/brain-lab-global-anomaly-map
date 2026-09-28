/**
 * Pinned 56-jurisdiction election-office roster.
 *
 * Every officeUrl below was read from the live USA.gov state-hub page
 * (https://www.usa.gov/states/{slug}, field-field-election-office) on
 * 2026-09-28. The verification harness
 * (scripts/verify-voter-dashboard.ts) re-checks each entry against the
 * live directory; update directoryVerifiedAt whenever it passes.
 */
import type { ElectionOffice, JurisdictionCode } from "./types";

export const DIRECTORY_VERIFIED_AT = "2026-09-28T21:30:00.000Z";
const V = DIRECTORY_VERIFIED_AT;

const O = (
  code: JurisdictionCode,
  jurisdiction: string,
  usaGovSlug: string,
  officeUrl: string,
  officeLabel: string
): ElectionOffice => ({ code, jurisdiction, usaGovSlug, officeUrl, officeLabel, directoryVerifiedAt: V });

export const ELECTION_OFFICES: ElectionOffice[] = [
  O("AL", "Alabama", "alabama", "https://www.sos.alabama.gov/alabama-votes", "Official Election Center"),
  O("AK", "Alaska", "alaska", "https://www.elections.alaska.gov/", "Division of Elections"),
  O("AZ", "Arizona", "arizona", "https://azsos.gov/elections", "Elections"),
  O("AR", "Arkansas", "arkansas", "https://www.sos.arkansas.gov/elections", "Elections, Secretary of State"),
  O("CA", "California", "california", "https://www.sos.ca.gov/elections", "Elections and Voter Information"),
  O("CO", "Colorado", "colorado", "https://www.sos.state.co.us/pubs/elections/main.html", "Elections and Voting"),
  O("CT", "Connecticut", "connecticut", "https://portal.ct.gov/sots/common-elements/v5-template---redesign/elections--voting--home-page", "Elections and Voting"),
  O("DE", "Delaware", "delaware", "https://elections.delaware.gov/index.shtml", "Department of Elections"),
  O("FL", "Florida", "florida", "https://www.dos.myflorida.com/elections/", "Division of Elections"),
  O("GA", "Georgia", "georgia", "https://sos.ga.gov/elections-division-georgia-secretary-states-office", "Elections Division of the Secretary of State Office"),
  O("HI", "Hawaii", "hawaii", "https://elections.hawaii.gov/", "Office of Elections"),
  O("ID", "Idaho", "idaho", "https://voteidaho.gov/", "Election and voting information"),
  O("IL", "Illinois", "illinois", "https://www.elections.il.gov/", "Board of Elections"),
  O("IN", "Indiana", "indiana", "https://indianavoters.in.gov/", "Voter Portal"),
  O("IA", "Iowa", "iowa", "https://sos.iowa.gov/elections/voterinformation/index.html", "Election and voting information"),
  O("KS", "Kansas", "kansas", "https://sos.ks.gov/elections/elections.html", "Elections"),
  O("KY", "Kentucky", "kentucky", "https://elect.ky.gov/Pages/default.aspx", "State Board of Elections"),
  O("LA", "Louisiana", "louisiana", "https://www.sos.la.gov/ElectionsAndVoting/Pages/default.aspx", "Elections and Voting"),
  O("ME", "Maine", "maine", "https://www.maine.gov/sos/cec/elec/index.html", "Elections and Voting"),
  O("MD", "Maryland", "maryland", "https://elections.maryland.gov/", "Election Information"),
  O("MA", "Massachusetts", "massachusetts", "https://www.sec.state.ma.us/divisions/elections/elections-and-voting.htm", "Elections and Voting"),
  O("MI", "Michigan", "michigan", "https://www.michigan.gov/sos/elections", "Elections"),
  O("MN", "Minnesota", "minnesota", "https://www.sos.state.mn.us/elections-voting/", "Elections and Voting"),
  O("MS", "Mississippi", "mississippi", "https://www.sos.ms.gov/elections-voting", "Elections and Voting"),
  O("MO", "Missouri", "missouri", "https://www.sos.mo.gov/elections/", "Elections and Voting"),
  O("MT", "Montana", "montana", "https://sosmt.gov/elections/", "Elections and Voter Services"),
  O("NE", "Nebraska", "nebraska", "https://www.nebraska.gov/featured/elections-voting/", "Elections and Voting"),
  O("NV", "Nevada", "nevada", "https://www.nvsos.gov/sos/elections", "Elections"),
  O("NH", "New Hampshire", "new-hampshire", "https://www.sos.nh.gov/elections/voters", "Voters and Elections"),
  O("NJ", "New Jersey", "new-jersey", "https://www.nj.gov/state/elections/vote.shtml", "Elections and Voting"),
  O("NM", "New Mexico", "new-mexico", "https://www.sos.nm.gov/voting-and-elections/voter-information-portal-nmvote-org/", "Voting and Elections"),
  O("NY", "New York", "new-york", "https://www.elections.ny.gov/", "Board of Elections"),
  O("NC", "North Carolina", "north-carolina", "https://www.ncsbe.gov/", "State Board of Elections"),
  O("ND", "North Dakota", "north-dakota", "https://vip.sos.nd.gov/PortalList.aspx", "Elections and Voting"),
  O("OH", "Ohio", "ohio", "https://www.sos.state.oh.us/elections/voters/", "Elections and Voting"),
  O("OK", "Oklahoma", "oklahoma", "https://oklahoma.gov/elections.html", "Election Board"),
  O("OR", "Oregon", "oregon", "https://sos.oregon.gov/voting-elections/Pages/default.aspx", "Voting and Elections"),
  O("PA", "Pennsylvania", "pennsylvania", "https://www.dos.pa.gov/VotingElections/Pages/default.aspx", "Voting & Elections"),
  O("RI", "Rhode Island", "rhode-island", "https://vote.sos.ri.gov/", "Voter Information Center"),
  O("SC", "South Carolina", "south-carolina", "https://www.scvotes.org/", "Election Commission"),
  O("SD", "South Dakota", "south-dakota", "https://sdsos.gov/elections-voting/default.aspx", "Division of Elections"),
  O("TN", "Tennessee", "tennessee", "https://sos.tn.gov/elections", "Elections"),
  O("TX", "Texas", "texas", "https://www.sos.state.tx.us/elections/index.shtml", "Elections and Voting"),
  O("UT", "Utah", "utah", "https://vote.utah.gov/", "Elections"),
  O("VT", "Vermont", "vermont", "https://sos.vermont.gov/elections/", "Elections Division"),
  O("VA", "Virginia", "virginia", "https://www.elections.virginia.gov/", "Department of Elections"),
  O("WA", "Washington", "washington", "https://www.sos.wa.gov/elections", "Elections and Voting"),
  O("WV", "West Virginia", "west-virginia", "https://sos.wv.gov/elections/pages/default.aspx", "Elections Division"),
  O("WI", "Wisconsin", "wisconsin", "https://myvote.wi.gov/en-us/", "Elections and Voting"),
  O("WY", "Wyoming", "wyoming", "https://sos.wyo.gov/Elections/Default.aspx", "Election Center"),
  O("DC", "District of Columbia", "district-of-columbia", "https://dcboe.org/", "Board of Elections"),
  O("PR", "Puerto Rico", "puerto-rico", "https://ww2.ceepur.org/", "Election Commission (in Spanish)"),
  O("GU", "Guam", "guam", "https://gec.guam.gov/", "Election Commission"),
  O("VI", "U.S. Virgin Islands", "u-s-virgin-islands", "https://vivote.gov/", "Elections and Voting"),
  O("AS", "American Samoa", "american-samoa", "https://aselectionoffice.gov/", "Election Office"),
  O("MP", "Northern Mariana Islands", "northern-mariana-islands", "https://www.votecnmi.gov.mp/", "Election Commission"),
];

export function getElectionOffice(code: string): ElectionOffice | undefined {
  return ELECTION_OFFICES.find((o) => o.code === code.toUpperCase());
}

/** Lowercase self-name tokens a jurisdiction's own site is expected to contain. */
export const JURISDICTION_NAME_TOKENS: Record<string, string[]> = {
  DC: ["district of columbia"],
  PR: ["puerto rico"],
  GU: ["guam"],
  VI: ["virgin islands"],
  AS: ["american samoa"],
  MP: ["mariana"],
};

export function nameTokensFor(office: ElectionOffice): string[] {
  return JURISDICTION_NAME_TOKENS[office.code] ?? [office.jurisdiction.toLowerCase()];
}
