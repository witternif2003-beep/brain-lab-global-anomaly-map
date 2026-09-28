import VoterDashboardGrid from "../../components/voter-registration/VoterDashboardGrid";

export const dynamic = "force-dynamic";

export default function VoterRegistrationPage() {
  return (
    <main className="min-h-screen bg-[#010610] text-[#e0f7fa] font-mono px-3 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full border font-bold uppercase tracking-wider text-[10px] text-[#e0aaff] border-[#bd00ff]/70 bg-[#1b0833]/70">
            56 official election offices
          </span>
          <span className="px-3 py-1 rounded-full border font-bold uppercase tracking-wider text-[10px] text-[#69f0ae] border-[#00ff88]/60 bg-[#002617]/70">
            live site probes
          </span>
          <span className="px-3 py-1 rounded-full border font-bold uppercase tracking-wider text-[10px] text-[#ff85d0] border-[#ff2d95]/60 bg-[#2a0618]/70">
            source: USA.gov directory
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-widest text-[#e0f7fa] uppercase">
          Election Sources — 50 states, DC &amp; 5 territories
        </h1>
        <p className="text-xs sm:text-sm text-[#80deea]/80 leading-relaxed max-w-4xl">
          Source monitor for the official election-office website of every state, DC and the five
          territories, as listed in the USA.gov state election office directory. Each site is fetched
          live: HTTP status, latency, a SHA-256 of the visible page text, and a check that the page
          names its own jurisdiction, folded into a reliability band from the probes actually
          observed. Each card also shows the official registered-voter total from the EAC 2024
          Election Administration and Voting Survey and any justice.gov press releases on
          voting-related cases that mention the jurisdiction. No voter file or person-level
          registration data exists in these sources, so none is shown.
        </p>
        <VoterDashboardGrid />
      </div>
    </main>
  );
}
