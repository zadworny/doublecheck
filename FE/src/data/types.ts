export type RelationshipType =
  | "CurrentEmployee"
  | "PastEmployee"
  | "CurrentContractor"
  | "PastContractor"
  | "ExternalRepresentative"
  | "AgencyRepresentative"
  | "Advisor";

export type RelationshipStatus =
  | "Active"
  | "Ended"
  | "Suspended"
  | "Withdrawn"
  | "Disputed";

export type MandateType =
  | "Recruitment"
  | "Sales"
  | "Consulting"
  | "Implementation"
  | "Communications"
  | "Legal"
  | "Advisory"
  | "EventRepresentation"
  | "Partnership";

export type MandateStatus =
  | "Active"
  | "Expired"
  | "Suspended"
  | "Withdrawn"
  | "Completed"
  | "Disputed";

export interface StatusEvent {
  status: string;
  at: string;
  note?: string;
}

export interface Organisation {
  id: string;
  blockNumber: number;
  name: string;
  domain: string;
  industry: string;
  jurisdiction: string;
  issuer: string;
  verified: boolean;
  verifiedAt: string;
}

export interface Person {
  id: string;
  name: string;
  headline: string;
  issuer: string;
  verified: boolean;
  verifiedAt: string;
}

export interface Relationship {
  kind: "relationship";
  id: string;
  organisationId: string;
  personId: string;
  type: RelationshipType;
  role: string;
  department?: string;
  startDate: string;
  endDate?: string | null;
  status: RelationshipStatus;
  confirmedAt: string;
  publicDisplay: boolean;
  history: StatusEvent[];
}

export interface Mandate {
  kind: "mandate";
  id: string;
  organisationId: string;
  representativeId: string;
  relationshipId: string;
  mandateType: MandateType;
  scope: string;
  territory?: string;
  validFrom: string;
  validTo: string;
  status: MandateStatus;
  confirmedAt: string;
  history: StatusEvent[];
}

export type Claim = Relationship | Mandate;
