import assert from "node:assert/strict";
import { test } from "node:test";
import { EAVS_2024_REGISTRATION } from "../../lib/elections/eavs-2024-registration";
import { ELECTION_OFFICES } from "../../lib/elections/election-offices";
import { classifyStage, fetchNoncitizenVotingReleases, isNoncitizenVotingTitle, toRelease } from "../../lib/elections/noncitizen-voting-cases";
import { registrationFor } from "../../lib/elections/registration";

test("EAVS registration covers exactly the 56 roster codes", () => {
  assert.deepEqual(Object.keys(EAVS_2024_REGISTRATION).sort(), ELECTION_OFFICES.map((o) => o.code).sort());
});

test("registrationFor reports sourced, partial and not-published honestly", () => {
  const ca = registrationFor("CA");
  assert.equal(ca.status, "sourced");
  assert.equal(ca.total, 25720597);
  const nd = registrationFor("ND");
  assert.equal(nd.status, "not-published");
  assert.equal(nd.total, null);
  assert.match(nd.note, /does not register voters/);
  const me = registrationFor("ME");
  assert.equal(me.status, "partial");
  assert.ok(me.reportingJurisdictions < me.jurisdictions);
});

test("noncitizen-voting title filter needs both a voting act and noncitizen status", () => {
  assert.ok(isNoncitizenVotingTitle("Mexican National Charged with Illegal Voting in Midland"));
  assert.ok(isNoncitizenVotingTitle("Iraqi Man Charged with Illegal Voting by an Alien"));
  assert.ok(!isNoncitizenVotingTitle("Felony Sex Offender Arrested for Illegally Voting in North Carolina Elections"));
  assert.ok(!isNoncitizenVotingTitle("Oklahoma Corrects Noncompliance with the National Voter Registration Act"));
  assert.ok(!isNoncitizenVotingTitle("Over 60 Undocumented Noncitizens Concealed in Box Truck"));
});

test("stage is read from the release title", () => {
  assert.equal(classifyStage("Haitian Citizen Sentenced for Voting by an Alien"), "sentenced");
  assert.equal(classifyStage("Alien Sent to Prison for Illegally Voting"), "sentenced");
  assert.equal(classifyStage("Three Noncitizens Convicted of Illegal Voting"), "convicted");
  assert.equal(classifyStage("Alien Admits to Illegally Voting in Federal Election"), "pleaded guilty");
  assert.equal(classifyStage("Feds Charge Russian National for Illegally Voting"), "charged");
  assert.equal(classifyStage("Alien Voting Case Update"), "see release");
});

test("releases are attributed only through the issuing USAO", () => {
  const nameToRelease = (component: string) =>
    toRelease({ uuid: "u", url: "https://www.justice.gov/x", title: "Alien Charged with Illegally Voting", date: "1767873600", component: [{ name: component }] });
  assert.deepEqual(nameToRelease("USAO - New Jersey")?.codes, ["NJ"]);
  assert.deepEqual(nameToRelease("USAO - Guam & Northern Mariana Islands")?.codes, ["GU", "MP"]);
  assert.deepEqual(nameToRelease("Civil Rights Division")?.codes, []);
  assert.equal(nameToRelease("USAO - New Jersey")?.date, "2026-01-08");
});

test("feed dedupes by uuid and records failed queries", async () => {
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    if (n === 1) return new Response("oops", { status: 503 });
    const body = { results: [{ uuid: "a", url: "https://www.justice.gov/a", title: "Cuban National Pleads Guilty to Illegally Voting", date: "1511784000", component: [{ name: "USAO - Missouri, Western" }] }] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const feed = await fetchNoncitizenVotingReleases(fetchImpl);
  assert.equal(feed.releases.length, 1);
  assert.deepEqual(feed.releases[0].codes, ["MO"]);
  assert.equal(feed.errors.length, 1);
  assert.equal(feed.pagesOk, feed.pagesTotal - 1);
});
