import type { GovEntity } from "./types";
import { CABINET_DEPARTMENTS } from "./telemetry-bindings/cabinet-departments";
import { INDEPENDENT_AGENCIES } from "./telemetry-bindings/independent-agencies";
import { BOARDS_AND_GSES } from "./telemetry-bindings/boards-gses";

export const GOV_ENTITIES: GovEntity[] = [
  ...CABINET_DEPARTMENTS,
  ...INDEPENDENT_AGENCIES,
  ...BOARDS_AND_GSES,
];

const BY_ID = new Map(GOV_ENTITIES.map((e) => [e.id, e]));

export function getGovEntity(id: string): GovEntity | undefined {
  return BY_ID.get(id);
}
