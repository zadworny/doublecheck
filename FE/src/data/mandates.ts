import { pseudoHash } from "../lib/hash";
import { organisations } from "./organisations";
import { people } from "./people";
import { findRelationship } from "./relationships";
import type {
  Mandate,
  MandateStatus,
  MandateType,
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

interface MandateOpts {
  territory?: string;
  status?: MandateStatus;
  note?: string;
  closedAt?: string;
}

let seq = 0;

function mandate(
  orgName: string,
  personName: string,
  relationshipType: RelationshipType,
  mandateType: MandateType,
  scope: string,
  validFrom: string,
  validTo: string,
  confirmedAt: string,
  opts: MandateOpts = {},
): Mandate {
  seq += 1;
  const org = findOrg(orgName);
  const p = findPerson(personName);
  const relationship = findRelationship(orgName, personName, relationshipType);
  const status: MandateStatus = opts.status ?? "Active";
  const id = pseudoHash(`mandate:${org.domain}:${p.name}:${mandateType}:${seq}`);

  const history: StatusEvent[] = [
    { status: "Created", at: validFrom, note: `Created by ${org.name}` },
    { status: "Accepted", at: confirmedAt, note: `Accepted by ${p.name}` },
    { status: "Active", at: confirmedAt },
  ];
  if (status !== "Active") {
    const at = opts.closedAt ?? validTo;
    const defaultNotes: Record<string, string> = {
      Expired: "Validity period passed without renewal",
      Suspended: "Suspended automatically — representative relationship under review",
      Withdrawn: "Authority withdrawn by organisation",
      Completed: "Engagement completed as scoped",
      Disputed: "Marked disputed pending correction",
    };
    history.push({ status, at, note: opts.note ?? defaultNotes[status] });
  }

  return {
    kind: "mandate",
    id,
    organisationId: org.id,
    representativeId: p.id,
    relationshipId: relationship.id,
    mandateType,
    scope,
    territory: opts.territory,
    validFrom,
    validTo,
    status,
    confirmedAt,
    history,
  };
}

export const mandates: Mandate[] = [
  mandate("Acme Robotics GmbH", "Mara Lindqvist", "ExternalRepresentative", "Recruitment", "Recruit for 2 Senior Robotics Engineer positions (req #ACM-204, #ACM-207)", "2026-01-10", "2026-04-10", "2026-01-11"),
  mandate("Acme Robotics GmbH", "Yusuf Demir", "ExternalRepresentative", "Recruitment", "Recruit for 1 Head of Manufacturing Operations position (req #ACM-211)", "2025-10-01", "2026-04-01", "2025-10-02"),
  mandate("Acme Robotics GmbH", "Lucas Fontaine", "ExternalRepresentative", "Legal", "Provide external legal representation for the Series B financing round", "2025-11-01", "2026-05-01", "2025-11-03"),
  mandate("Acme Robotics GmbH", "Priya Chandran", "ExternalRepresentative", "Consulting", "Deliver a data strategy assessment for Q2 2026", "2026-01-20", "2026-04-20", "2026-01-22", { status: "Completed", closedAt: "2026-04-18" }),

  mandate("Nordlicht Systems AG", "Nina Kowalski", "ExternalRepresentative", "Recruitment", "Recruit for 3 Backend Engineer positions (req #NLS-118 to #NLS-120)", "2026-01-15", "2026-06-15", "2026-01-16"),
  mandate("Nordlicht Systems AG", "Oliver Bennett", "ExternalRepresentative", "Communications", "Represent Nordlicht Systems to press regarding the Series C announcement", "2025-09-01", "2026-01-31", "2025-09-03", { status: "Withdrawn", closedAt: "2026-01-05" }),

  mandate("Vela Health Technologies", "Yusuf Demir", "ExternalRepresentative", "Recruitment", "Recruit for 2 Engineering positions (req #VHT-045, #VHT-046)", "2026-02-01", "2026-05-01", "2026-02-02", { status: "Suspended", closedAt: "2026-03-15" }),
  mandate("Vela Health Technologies", "Priya Chandran", "ExternalRepresentative", "Consulting", "Deliver a predictive maintenance data pipeline", "2025-12-01", "2026-06-01", "2025-12-03"),
  mandate("Vela Health Technologies", "Robert Kim", "AgencyRepresentative", "Sales", "Represent Vela Health to DACH regional channel partners for the Vela Care platform", "2025-06-01", "2026-06-01", "2025-06-02", { territory: "DACH" }),
  mandate("Vela Health Technologies", "Amir Haddad", "Advisor", "Advisory", "Provide strategic advisory on international market expansion", "2024-06-01", "2026-06-01", "2024-06-05"),
  mandate("Vela Health Technologies", "Fatima Zahra", "ExternalRepresentative", "Legal", "Provide external legal representation for data protection compliance", "2025-07-01", "2026-07-01", "2025-07-03"),

  mandate("Solstice Analytics", "Robert Kim", "AgencyRepresentative", "Sales", "Represent Solstice Analytics reseller channel across the Benelux region", "2025-08-01", "2026-08-01", "2025-08-03", { territory: "Benelux" }),
  mandate("Kestrel Freight Group", "Nina Kowalski", "ExternalRepresentative", "Recruitment", "Recruit for 1 Regional Operations Manager position (req #KFG-032)", "2026-02-10", "2026-03-10", "2026-02-11", { status: "Expired" }),
  mandate("Kestrel Freight Group", "Lucas Fontaine", "ExternalRepresentative", "Legal", "Provide legal representation for the EU customs compliance review", "2025-05-01", "2026-05-01", "2025-05-03"),
];

export function getMandate(id: string): Mandate | undefined {
  return mandates.find((m) => m.id === id);
}

export function getMandatesForOrganisation(organisationId: string): Mandate[] {
  return mandates.filter((m) => m.organisationId === organisationId);
}

export function getMandatesForPerson(personId: string): Mandate[] {
  return mandates.filter((m) => m.representativeId === personId);
}
