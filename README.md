# BRAIN LAB BY LILIYA — Global Anomaly Map

**Post-Doctorate Cognitive Market Intelligence & Microstructure Research**

A branded, interactive public-source intelligence dashboard featuring verified Georgia state economic anomaly telemetry, competitor state exploitation playbooks, auditable primary evidence cards, and scientific methodology documentation.

---

## Architecture & Surface Overview

1. **Surface 1: Live Telemetry Dashboard (`/`)**
   - Full-screen responsive vector map powered by MapLibre GL and US Census TIGER boundaries.
   - Pulsing anomaly nodes positioned over Georgia targets (Port of Savannah, Atlanta Headquarters Hub, Gwinnett Bio-Corridor, Macon Medical Infrastructure, Douglasville Data Centers).
   - Dynamic inspector drawer displaying observed deviation magnitudes, baseline models, and beneficiary competitor states.
   - Continuous radar cards tracking 6 key monitored domains.

2. **Surface 2: Individual Anomaly Widgets (`/anomalies`)**
   - Filterable catalog of verified economic anomalies across Logistics, Fiscal & Tax, Healthcare, Labor, Infrastructure, and Regulatory sectors.
   - Detailed evidence chain inspection: primary sources, corroborating datasets, and NATO/Admiralty System reliability ratings (A1 / A2).
   - CSV export functionality for offline intelligence briefings.

3. **Surface 3: Insider Intel (Competitor Playbooks) (`/insider-intel`)**
   - Dedicated dossiers tailored for competitor states: **North Carolina (NC)**, **Tennessee (TN)**, **Florida (FL)**, **South Carolina (SC)**, and **Texas (TX)**.
   - Comparative head-to-head microstructure tables quantifying corporate tax disparities, healthcare workforce density, port draft depths, and grid interconnection queues.
   - Active, actionable recruitment and freight diversion campaign playbooks.

4. **Surface 4: Public-Source Evidence Cards (`/evidence`)**
   - Structured evidence card catalog categorized by the 4 Core Pillars: Logistics, Incentives, Workforce Quality, and Fiscal Stress.
   - Verifiable dataset identifiers, official reporting agencies, public domain licenses, and confidence scoring.

5. **Surface 5: Methodology Page (`/methodology`)**
   - Deep-dive documentation into the hybrid ML anomaly detection pipeline (LSTM-AE, LSTD-Detect, STGNN, Isolation Forest).
   - NATO / Admiralty System source credibility scoring standards.
   - Legal compliance and open-source public record boundary statements.

---

## Quickstart & Local Execution

```bash
cd /home/user/brain-lab
npm run build
npm run start -- -H 0.0.0.0 -p 3001
```

Access the dashboard in your browser at `http://localhost:3001`.
