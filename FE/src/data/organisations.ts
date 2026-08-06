import { pseudoHash } from "../lib/hash";
import type { Organisation } from "./types";

function org(
  blockNumber: number,
  name: string,
  domain: string,
  industry: string,
  jurisdiction: string,
  verifiedAt: string,
): Organisation {
  return {
    id: pseudoHash(`org:${domain}`),
    blockNumber,
    name,
    domain,
    industry,
    jurisdiction,
    issuer: "Jobited",
    verified: true,
    verifiedAt,
  };
}

export const organisations: Organisation[] = [
  org(1042, "Acme Robotics GmbH", "acme-robotics.de", "Robotics & Manufacturing", "Germany", "2026-02-11"),
  org(1051, "Nordlicht Systems AG", "nordlicht-systems.com", "Enterprise Software", "Germany", "2026-02-18"),
  org(1063, "Beacon Talent Partners", "beacontalent.com", "Recruitment & Staffing", "Netherlands", "2026-02-24"),
  org(1078, "Halberg & Vance LLP", "halbergvance.co.uk", "Legal Services", "United Kingdom", "2026-03-03"),
  org(1094, "Vela Health Technologies", "velahealth.io", "Health Technology", "Sweden", "2026-03-09"),
  org(1107, "Solstice Analytics", "solstice-analytics.fr", "Data & Analytics", "France", "2026-03-16"),
  org(1119, "Kestrel Freight Group", "kestrelfreight.com", "Logistics", "Netherlands", "2026-03-22"),
];

export function getOrganisation(id: string): Organisation | undefined {
  return organisations.find((o) => o.id === id);
}
