import { pseudoHash } from "../lib/hash";
import { organisations } from "./organisations";
import { people } from "./people";
import type {
  Relationship,
  RelationshipStatus,
  RelationshipType,
  StatusEvent,
} from "./types";

function findOrg(name: string) {
  const o = organisations.find((x) => x.name === name);
  if (!o) throw new Error(`Unknown organisation: ${name}`);
  return o;
}

function findPerson(name: string) {
  const p = people.find((x) => x.name === name);
  if (!p) throw new Error(`Unknown person: ${name}`);
  return p;
}

interface RelOpts {
  department?: string;
  endDate?: string | null;
  status?: RelationshipStatus;
  publicDisplay?: boolean;
  note?: string;
}

let seq = 0;

function rel(
  orgName: string,
  personName: string,
  type: RelationshipType,
  role: string,
  startDate: string,
  confirmedAt: string,
  opts: RelOpts = {},
): Relationship {
  seq += 1;
  const org = findOrg(orgName);
  const p = findPerson(personName);
  const status: RelationshipStatus = opts.status ?? "Active";
  const id = pseudoHash(`rel:${org.domain}:${p.name}:${type}:${seq}`);

  const history: StatusEvent[] = [
    { status: "Proposed", at: startDate, note: `Proposed by ${org.name}` },
    { status: "Accepted", at: confirmedAt, note: `Accepted by ${p.name}` },
    { status: "Active", at: confirmedAt },
  ];
  if (status !== "Active") {
    const at = opts.endDate ?? confirmedAt;
    const defaultNotes: Record<string, string> = {
      Ended: "Relationship ended normally",
      Suspended: "Temporarily suspended pending review",
      Withdrawn: "Authority withdrawn by organisation",
      Disputed: "Marked disputed pending correction",
    };
    history.push({ status, at, note: opts.note ?? defaultNotes[status] });
  }

  return {
    kind: "relationship",
    id,
    organisationId: org.id,
    personId: p.id,
    type,
    role,
    department: opts.department,
    startDate,
    endDate: opts.endDate ?? null,
    status,
    confirmedAt,
    publicDisplay: opts.publicDisplay ?? true,
    history,
  };
}

export const relationships: Relationship[] = [
  // Acme Robotics GmbH
  rel("Acme Robotics GmbH", "Elena Marchetti", "CurrentEmployee", "Robotics Engineer", "2023-04-01", "2023-04-03", { department: "Engineering" }),
  rel("Acme Robotics GmbH", "Jonas Vogt", "PastEmployee", "Engineering Lead", "2019-03-01", "2019-03-04", { department: "Engineering", status: "Ended", endDate: "2025-12-15" }),
  rel("Acme Robotics GmbH", "Marco Bianchi", "PastContractor", "Automation Contractor", "2022-01-01", "2022-01-05", { department: "Engineering", status: "Disputed", endDate: "2023-06-30", note: "Contractor disputes recorded end date" }),
  rel("Acme Robotics GmbH", "Mara Lindqvist", "ExternalRepresentative", "External Recruiter", "2026-01-10", "2026-01-11"),
  rel("Acme Robotics GmbH", "Lucas Fontaine", "ExternalRepresentative", "External Legal Counsel", "2025-11-01", "2025-11-03"),
  rel("Acme Robotics GmbH", "Yusuf Demir", "ExternalRepresentative", "External Recruiter", "2025-10-01", "2025-10-02"),
  rel("Acme Robotics GmbH", "Priya Chandran", "ExternalRepresentative", "Data Strategy Consultant", "2026-01-20", "2026-01-22"),

  // Nordlicht Systems AG
  rel("Nordlicht Systems AG", "Tom Bergström", "CurrentEmployee", "Product Manager", "2021-09-01", "2021-09-03", { department: "Product" }),
  rel("Nordlicht Systems AG", "Clara Dubois", "CurrentEmployee", "Frontend Engineer", "2024-02-01", "2024-02-02", { department: "Engineering" }),
  rel("Nordlicht Systems AG", "Isabel Reyes", "PastEmployee", "Analytics Lead", "2020-05-01", "2020-05-04", { department: "Data", status: "Ended", endDate: "2025-08-31" }),
  rel("Nordlicht Systems AG", "Marco Bianchi", "PastContractor", "Automation Contractor", "2021-01-01", "2021-01-04", { department: "Engineering", status: "Ended", endDate: "2021-12-31" }),
  rel("Nordlicht Systems AG", "Nina Kowalski", "ExternalRepresentative", "External Recruiter", "2026-01-15", "2026-01-16"),
  rel("Nordlicht Systems AG", "Oliver Bennett", "ExternalRepresentative", "Communications Consultant", "2025-09-01", "2025-09-03", { status: "Withdrawn", endDate: "2026-01-05", note: "Engagement concluded early; authority withdrawn" }),

  // Beacon Talent Partners (recruitment agency — employer of the recruiters)
  rel("Beacon Talent Partners", "Mara Lindqvist", "CurrentEmployee", "Senior Technical Recruiter", "2022-06-01", "2022-06-03", { department: "Recruitment" }),
  rel("Beacon Talent Partners", "Nina Kowalski", "CurrentEmployee", "Recruitment Consultant", "2023-02-01", "2023-02-02", { department: "Recruitment" }),
  rel("Beacon Talent Partners", "Yusuf Demir", "CurrentEmployee", "Talent Acquisition Partner", "2021-11-01", "2021-11-03", { department: "Recruitment" }),

  // Halberg & Vance LLP
  rel("Halberg & Vance LLP", "Lucas Fontaine", "CurrentEmployee", "Legal Counsel", "2020-01-01", "2020-01-05", { department: "Corporate" }),
  rel("Halberg & Vance LLP", "Fatima Zahra", "CurrentEmployee", "Associate Solicitor", "2023-09-01", "2023-09-04", { department: "Litigation" }),

  // Vela Health Technologies
  rel("Vela Health Technologies", "David Okafor", "CurrentEmployee", "Backend Engineer", "2022-03-01", "2022-03-03", { department: "Engineering" }),
  rel("Vela Health Technologies", "Robert Kim", "AgencyRepresentative", "Channel Sales Agent", "2025-06-01", "2025-06-02"),
  rel("Vela Health Technologies", "Yusuf Demir", "ExternalRepresentative", "External Recruiter", "2026-02-01", "2026-02-02", { status: "Suspended", endDate: "2026-03-15", note: "Under compliance review" }),
  rel("Vela Health Technologies", "Priya Chandran", "ExternalRepresentative", "Data Strategy Consultant", "2025-12-01", "2025-12-03"),
  rel("Vela Health Technologies", "Amir Haddad", "Advisor", "Strategic Advisor", "2024-06-01", "2024-06-05"),
  rel("Vela Health Technologies", "Fatima Zahra", "ExternalRepresentative", "External Legal Counsel", "2025-07-01", "2025-07-03"),

  // Solstice Analytics
  rel("Solstice Analytics", "Ingrid Solberg", "CurrentEmployee", "Senior Data Scientist", "2021-07-01", "2021-07-03", { department: "Data Science" }),
  rel("Solstice Analytics", "Amir Haddad", "Advisor", "Strategic Advisor", "2024-01-01", "2024-01-04"),
  rel("Solstice Analytics", "Priya Chandran", "ExternalRepresentative", "Data Strategy Consultant", "2025-10-15", "2025-10-17"),
  rel("Solstice Analytics", "Robert Kim", "AgencyRepresentative", "Channel Sales Agent", "2025-08-01", "2025-08-03"),
  rel("Solstice Analytics", "Henrik Johansson", "Advisor", "Logistics Data Advisor", "2025-02-01", "2025-02-03"),
  rel("Solstice Analytics", "Mara Lindqvist", "ExternalRepresentative", "External Recruiter", "2026-03-10", "2026-03-11"),

  // Kestrel Freight Group
  rel("Kestrel Freight Group", "Greta Almqvist", "CurrentEmployee", "Fleet Operations Lead", "2019-11-01", "2019-11-04", { department: "Operations" }),
  rel("Kestrel Freight Group", "Sophie Laurent", "PastEmployee", "Operations Manager", "2018-01-01", "2018-01-05", { department: "Operations", status: "Ended", endDate: "2025-05-31" }),
  rel("Kestrel Freight Group", "Henrik Johansson", "Advisor", "Logistics Advisor", "2023-01-01", "2023-01-03"),
  rel("Kestrel Freight Group", "Mara Lindqvist", "ExternalRepresentative", "External Recruiter", "2026-03-01", "2026-03-02"),
  rel("Kestrel Freight Group", "Nina Kowalski", "ExternalRepresentative", "External Recruiter", "2026-02-10", "2026-02-11"),
  rel("Kestrel Freight Group", "Lucas Fontaine", "ExternalRepresentative", "External Legal Counsel", "2025-05-01", "2025-05-03"),
];

export function getRelationship(id: string): Relationship | undefined {
  return relationships.find((r) => r.id === id);
}

export function findRelationship(
  orgName: string,
  personName: string,
  type?: RelationshipType,
): Relationship {
  const org = findOrg(orgName);
  const p = findPerson(personName);
  const found = relationships.find(
    (r) =>
      r.organisationId === org.id &&
      r.personId === p.id &&
      (!type || r.type === type),
  );
  if (!found) {
    throw new Error(`Relationship not found: ${personName} @ ${orgName}`);
  }
  return found;
}

export function getRelationshipsForOrganisation(organisationId: string): Relationship[] {
  return relationships.filter((r) => r.organisationId === organisationId);
}

export function getRelationshipsForPerson(personId: string): Relationship[] {
  return relationships.filter((r) => r.personId === personId);
}
