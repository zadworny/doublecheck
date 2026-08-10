/**
 * Holder-initiated writes to the DoubleCheck registry.
 *
 * Secret keys never enter the application. Freighter receives an assembled
 * transaction XDR, signs it inside the extension, and returns only the signed
 * envelope. Every write is pinned to the connected address and configured
 * Stellar network before it is simulated or offered for signature.
 */

import { Buffer } from "buffer";
import { getAddress, getNetwork, signTransaction as freighterSignTransaction } from "@stellar/freighter-api";
import type { AssembledTransaction, Result, SignTransaction } from "@stellar/stellar-sdk/contract";
import {
  ClaimStatus,
  Client,
  Confirmation,
  MandateType as ChainMandateType,
  RelationshipType as ChainRelationshipType,
  type Mandate as ChainMandate,
  type MandateType,
  type Relationship as ChainRelationship,
  type RelationshipType,
} from "../contract/registry";
import type { Organisation, Person } from "../data/types";
import { chainConfig, read, registry } from "./chain";

const WRITE_TIMEOUT_SECONDS = 90;
const MAX_TEXT_BYTES = 128;

const CLAIM_STATUS_LABEL: Partial<Record<ClaimStatus, string>> = {
  [ClaimStatus.Active]: "Active",
  [ClaimStatus.Ended]: "Ended",
  [ClaimStatus.Suspended]: "Suspended",
  [ClaimStatus.Withdrawn]: "Withdrawn",
  [ClaimStatus.Disputed]: "Disputed",
  [ClaimStatus.Completed]: "Completed",
  [ClaimStatus.Expired]: "Expired",
};

const CONFIRMATION_LABEL: Partial<Record<Confirmation, string>> = {
  [Confirmation.SelfAsserted]: "Self-asserted",
  [Confirmation.CounterpartyConfirmed]: "Confirmed by the organisation",
  [Confirmation.IssuerConfirmed]: "Confirmed by the issuer",
};

const RELATIONSHIP_TYPE_LABEL: Partial<Record<ChainRelationshipType, string>> = {
  [ChainRelationshipType.CurrentEmployee]: "Current employee",
  [ChainRelationshipType.PastEmployee]: "Past employee",
  [ChainRelationshipType.CurrentContractor]: "Current contractor",
  [ChainRelationshipType.PastContractor]: "Past contractor",
  [ChainRelationshipType.ExternalRepresentative]: "External representative",
  [ChainRelationshipType.AgencyRepresentative]: "Agency representative",
  [ChainRelationshipType.Advisor]: "Advisor",
};

const MANDATE_TYPE_LABEL: Partial<Record<ChainMandateType, string>> = {
  [ChainMandateType.Recruitment]: "Recruitment",
  [ChainMandateType.Sales]: "Sales",
  [ChainMandateType.Consulting]: "Consulting",
  [ChainMandateType.Implementation]: "Implementation",
  [ChainMandateType.Communications]: "Communications",
  [ChainMandateType.Legal]: "Legal",
  [ChainMandateType.Advisory]: "Advisory",
  [ChainMandateType.EventRepresentation]: "Event representation",
  [ChainMandateType.Partnership]: "Partnership",
};

type Entity = Organisation | Person;

export type WriteFailureKind =
  | "rejected"
  | "wallet"
  | "network"
  | "controller"
  | "unfunded"
  | "archived"
  | "contract"
  | "simulation"
  | "submission";

export class WriteFailure extends Error {
  constructor(
    public readonly kind: WriteFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "WriteFailure";
  }
}

export interface WriteReceipt<T> {
  result: T;
  hash: string;
  ledger: number;
  explorerUrl: string;
}

export interface PreparedClaim<TInput> {
  input: TInput;
  exactStatement: string;
  canonicalStatement: string;
  detailHash: Buffer;
  detailHashHex: string;
  confirmation: "CounterpartyConfirmed" | "SelfAsserted";
  confirmationLabel: string;
}

export interface RelationshipInput {
  caller: string;
  actor: Entity;
  organisation: Organisation;
  person: Person;
  relationshipType: RelationshipType;
  role: string;
  department: string;
  startAt: number;
  endAt: number;
  publicDisplay: boolean;
}

export interface MandateInput {
  caller: string;
  actor: Entity;
  organisation: Organisation;
  representative: Entity;
  relationshipId: string | null;
  mandateType: MandateType;
  scope: string;
  territory: string;
  validFrom: number;
  validUntil: number;
}

export interface WithdrawalInput {
  caller: string;
  actor: Entity;
  claim: HolderClaim;
}

export interface PreparedWithdrawal {
  input: WithdrawalInput;
  exactStatement: string;
  confirmationLabel: string;
}

export interface PublicationInput {
  caller: string;
  actor: Person;
  claim: HolderClaim;
  publicDisplay: boolean;
}

export interface PreparedPublication {
  input: PublicationInput;
  exactStatement: string;
  confirmationLabel: string;
}

/**
 * The minimum claim view needed by the holder console. It is loaded
 * from the contract's party indexes rather than the public RegistryContext, so
 * a relationship with `public_display = false` remains absent from public
 * search while its subject can still object to or withdraw it.
 */
export interface HolderClaim {
  kind: "relationship" | "mandate";
  id: string;
  organisationId: string;
  subjectId: string;
  status: ClaimStatus;
  statusLabel: string;
  confirmationLabel: string;
  typeLabel: string;
  summary: string;
  publicDisplay?: boolean;
}

/** Reads every claim for which the badge is an on-chain party. No signature. */
export async function loadHolderClaims(actor: Entity): Promise<HolderClaim[]> {
  const client = registry();
  const actorId = entityId(actor.id, "Entity");
  const [relationshipIds, mandateIds] = await Promise.all([
    actor.kind === "organisation"
      ? read(client.relationships_attested_by({ org: actorId }))
      : read(client.relationships_about({ person: actorId })),
    actor.kind === "organisation"
      ? Promise.all([
          read(client.mandates_issued_by({ org: actorId })),
          read(client.mandates_held_by({ representative: actorId })),
        ]).then(([issued, held]) => [...new Map([...issued, ...held].map((id) => [id.toString(), id])).values()])
      : read(client.mandates_held_by({ representative: actorId })),
  ]);

  const [relationships, mandates] = await Promise.all([
    Promise.all(
      relationshipIds.map(async (id) => {
        const [claim, effectiveStatus] = await Promise.all([
          read(client.get_relationship({ id })),
          read(client.relationship_status({ id })),
        ]);
        if (!claim) return null;
        return toHolderRelationship(claim, effectiveStatus ?? claim.status);
      }),
    ),
    Promise.all(
      mandateIds.map(async (id) => {
        const [claim, effectiveStatus] = await Promise.all([
          read(client.get_mandate({ id })),
          read(client.mandate_status({ id })),
        ]);
        if (!claim) return null;
        return toHolderMandate(claim, effectiveStatus ?? claim.status);
      }),
    ),
  ]);

  const claims: Array<HolderClaim | null> = [...relationships, ...mandates];
  return claims
    .filter((claim): claim is HolderClaim => claim !== null)
    .sort((a, b) => compareDecimalIds(b.id, a.id));
}

/**
 * Direct fallback for claims missing from a bounded/best-effort party index.
 * The contract remains the authority: a claim is returned only when the badge
 * is actually one of its parties.
 */
export async function loadHolderClaim(actor: Entity, claimId: string): Promise<HolderClaim> {
  const id = entityId(claimId, "Claim");
  const client = registry();
  const [relationship, mandate, relationshipStatus, mandateStatus] = await Promise.all([
    read(client.get_relationship({ id })),
    read(client.get_mandate({ id })),
    read(client.relationship_status({ id })),
    read(client.mandate_status({ id })),
  ]);
  const claim = relationship
    ? toHolderRelationship(relationship, relationshipStatus ?? relationship.status)
    : mandate
      ? toHolderMandate(mandate, mandateStatus ?? mandate.status)
      : null;
  if (!claim) throw new WriteFailure("contract", `Claim #${claimId} does not exist.`);
  assertWithdrawalAuthority(actor, claim);
  return claim;
}

export function canWithdrawHolderClaim(claim: HolderClaim): boolean {
  return claim.kind === "relationship"
    ? claim.status !== ClaimStatus.Withdrawn && claim.status !== ClaimStatus.Ended
    : claim.status !== ClaimStatus.Withdrawn && claim.status !== ClaimStatus.Completed;
}

function toHolderRelationship(
  claim: ChainRelationship,
  status: ClaimStatus,
): HolderClaim {
  return {
    kind: "relationship",
    id: claim.id.toString(),
    organisationId: claim.org.toString(),
    subjectId: claim.person.toString(),
    status,
    statusLabel: CLAIM_STATUS_LABEL[status] ?? "Unknown",
    confirmationLabel: CONFIRMATION_LABEL[claim.confirmation] ?? "Unknown provenance",
    typeLabel: RELATIONSHIP_TYPE_LABEL[claim.rel_type] ?? "Affiliation",
    summary: `${claim.role}${claim.department ? ` — ${claim.department}` : ""}`,
    publicDisplay: claim.public_display,
  };
}

function toHolderMandate(claim: ChainMandate, status: ClaimStatus): HolderClaim {
  return {
    kind: "mandate",
    id: claim.id.toString(),
    organisationId: claim.org.toString(),
    subjectId: claim.representative.toString(),
    status,
    statusLabel: CLAIM_STATUS_LABEL[status] ?? "Unknown",
    confirmationLabel: CONFIRMATION_LABEL[claim.confirmation] ?? "Unknown provenance",
    typeLabel: MANDATE_TYPE_LABEL[claim.mandate_type] ?? "Mandate",
    summary: `${claim.scope}${claim.territory ? ` — ${claim.territory}` : ""}`,
  };
}

/**
 * Produces and hashes the exact canonical payload represented by a relationship
 * write. The digest is sent as the contract's `detail_hash`.
 */
export async function prepareRelationship(
  raw: RelationshipInput,
): Promise<PreparedClaim<RelationshipInput>> {
  const caller = normalizeAddress(raw.caller);
  assertActor(raw.actor, caller);
  assertRelationshipAuthority(raw.actor, raw.organisation, raw.person);

  const role = requiredText(raw.role, "Role");
  const department = optionalText(raw.department, "Department");
  const startAt = timestamp(raw.startAt, "Start date");
  const endAt = raw.endAt === 0 ? 0 : timestamp(raw.endAt, "End date");
  if (startAt > Math.floor(Date.now() / 1000)) {
    throw new WriteFailure("contract", "The relationship start date cannot be in the future.");
  }
  if (endAt !== 0 && endAt < startAt) {
    throw new WriteFailure("contract", "End date must be on or after the start date.");
  }

  const selfAsserted = raw.actor.kind === "person";
  // An organisation cannot prove that the person consented to publication.
  // The subject can opt in later; their own self-assertion is already consent.
  const publicDisplay = selfAsserted ? raw.publicDisplay : false;
  const confirmation = selfAsserted ? "SelfAsserted" : "CounterpartyConfirmed";
  const relationshipTypeLabel =
    RELATIONSHIP_TYPE_LABEL[raw.relationshipType] ?? "Affiliation";
  const confirmationLabel = selfAsserted
    ? "Self-asserted proposal — not confirmed by the organisation"
    : "Company-confirmed — signed by the organisation controller";

  const exactStatement = selfAsserted
    ? `${entityLabel(raw.person)} self-asserts a ${relationshipTypeLabel.toLowerCase()} affiliation with ${entityLabel(raw.organisation)} as ${quote(role)}${department ? ` in ${quote(department)}` : ""}, from ${iso(startAt)}${endAt ? ` until ${iso(endAt)}` : " with no stated end date"}. This is a proposal made by the person, not confirmation by the organisation. DoubleCheck public listing is ${publicDisplay ? "enabled" : "disabled"}; the underlying Soroban record remains publicly inspectable.`
    : `${entityLabel(raw.organisation)} attests that ${entityLabel(raw.person)} has a ${relationshipTypeLabel.toLowerCase()} relationship as ${quote(role)}${department ? ` in ${quote(department)}` : ""}, from ${iso(startAt)}${endAt ? ` until ${iso(endAt)}` : " with no stated end date"}. The record is omitted from DoubleCheck public listings until the person permits publication; the underlying Soroban record remains publicly inspectable.`;

  const input: RelationshipInput = {
    ...raw,
    caller,
    role,
    department,
    startAt,
    endAt,
    publicDisplay,
  };
  const statement = {
    schema: "doublecheck.relationship.v1",
    action: "attest_relationship",
    contract: chainConfig.contractId,
    network_passphrase: chainConfig.networkPassphrase,
    caller,
    confirmation,
    org: raw.organisation.id,
    person: raw.person.id,
    relationship_type: relationshipTypeLabel,
    role,
    department,
    start_at: startAt,
    end_at: endAt,
    public_display: publicDisplay,
    exact_statement: exactStatement,
  };
  const canonicalStatement = canonicalJson(statement);
  const detailHash = await sha256(canonicalStatement);

  return {
    input,
    exactStatement,
    canonicalStatement,
    detailHash,
    detailHashHex: detailHash.toString("hex"),
    confirmation,
    confirmationLabel,
  };
}

/** Prepares the exact statement and digest represented by a mandate write. */
export async function prepareMandate(raw: MandateInput): Promise<PreparedClaim<MandateInput>> {
  const caller = normalizeAddress(raw.caller);
  assertActor(raw.actor, caller);
  assertMandateAuthority(raw.actor, raw.organisation, raw.representative);

  const scope = requiredText(raw.scope, "Scope");
  const territory = optionalText(raw.territory, "Territory");
  const validFrom = timestamp(raw.validFrom, "Valid from");
  const validUntil = timestamp(raw.validUntil, "Valid until");
  if (validUntil <= validFrom) {
    throw new WriteFailure("contract", "The mandate must end after it begins.");
  }
  if (validUntil <= Math.floor(Date.now() / 1000)) {
    throw new WriteFailure("contract", "The mandate must end in the future.");
  }
  if (validUntil - validFrom > 366 * 24 * 60 * 60) {
    throw new WriteFailure("contract", "This holder flow limits mandates to one year.");
  }
  const relationshipId = raw.relationshipId ? idString(raw.relationshipId, "Relationship") : null;

  const selfAsserted = raw.actor.id === raw.representative.id;
  const confirmation = selfAsserted ? "SelfAsserted" : "CounterpartyConfirmed";
  const mandateTypeLabel = MANDATE_TYPE_LABEL[raw.mandateType] ?? "Mandate";
  const confirmationLabel = selfAsserted
    ? "Self-asserted proposal — not company authorisation"
    : "Company-confirmed mandate — signed by the organisation controller";

  const exactStatement = selfAsserted
    ? `${entityLabel(raw.representative)} proposes that ${entityLabel(raw.organisation)} authorise ${entityLabel(raw.representative)} for ${mandateTypeLabel}: ${quote(scope)}${territory ? ` in ${quote(territory)}` : " worldwide"}, from ${iso(validFrom)} until ${iso(validUntil)}${relationshipId ? `, supported by public affiliation claim #${relationshipId}` : ", as a standalone mandate"}. This is self-asserted and is not proof that the organisation agreed.`
    : `${entityLabel(raw.organisation)} authorises ${entityLabel(raw.representative)} for ${mandateTypeLabel}: ${quote(scope)}${territory ? ` in ${quote(territory)}` : " worldwide"}, from ${iso(validFrom)} until ${iso(validUntil)}${relationshipId ? `, supported by public affiliation claim #${relationshipId}` : ", as a standalone mandate"}.`;

  const input: MandateInput = {
    ...raw,
    caller,
    scope,
    territory,
    validFrom,
    validUntil,
    relationshipId,
  };
  const statement = {
    schema: "doublecheck.mandate.v1",
    action: "issue_mandate",
    contract: chainConfig.contractId,
    network_passphrase: chainConfig.networkPassphrase,
    caller,
    confirmation,
    org: raw.organisation.id,
    representative: raw.representative.id,
    relationship: relationshipId ?? "0",
    mandate_type: mandateTypeLabel,
    scope,
    territory,
    valid_from: validFrom,
    valid_until: validUntil,
    exact_statement: exactStatement,
  };
  const canonicalStatement = canonicalJson(statement);
  const detailHash = await sha256(canonicalStatement);

  return {
    input,
    exactStatement,
    canonicalStatement,
    detailHash,
    detailHashHex: detailHash.toString("hex"),
    confirmation,
    confirmationLabel,
  };
}

export function prepareWithdrawal(input: WithdrawalInput): PreparedWithdrawal {
  const caller = normalizeAddress(input.caller);
  assertActor(input.actor, caller);
  assertWithdrawalAuthority(input.actor, input.claim);
  const kind = input.claim.kind === "relationship" ? "relationship" : "mandate";
  return {
    input: { ...input, caller },
    exactStatement: `${entityLabel(input.actor)} withdraws ${kind} claim #${input.claim.id}. The claim remains in Stellar history but must no longer be treated as active.`,
    confirmationLabel: "Withdrawal — signed by the current entity controller",
  };
}

/** Prepares a subject's verifier-listing choice; it never changes claim truth or ledger visibility. */
export function preparePublication(input: PublicationInput): PreparedPublication {
  const caller = normalizeAddress(input.caller);
  assertActor(input.actor, caller);
  assertPublicationAuthority(input.actor, input.claim);
  return {
    input: { ...input, caller },
    exactStatement: input.publicDisplay
      ? `${entityLabel(input.actor)} permits relationship claim #${input.claim.id} to appear in official DoubleCheck verifier listings. This is display consent only: it does not confirm that the relationship is true or company-authorised, and the underlying Soroban record was already public.`
      : `${entityLabel(input.actor)} removes relationship claim #${input.claim.id} from official DoubleCheck verifier listings. The underlying Soroban record remains public, but DoubleCheck must no longer render it in public pages, search, feeds, or linked mandate verdicts.`,
    confirmationLabel: "Verifier display choice — signed by the relationship subject",
  };
}

export async function submitRelationship(
  prepared: PreparedClaim<RelationshipInput>,
): Promise<WriteReceipt<bigint>> {
  const { input } = prepared;
  return submitResult(input.caller, input.actor.id, (client) =>
    client.attest_relationship(
      {
        caller: input.caller,
        org: entityId(input.organisation.id, "Organisation"),
        person: entityId(input.person.id, "Person"),
        rel_type: input.relationshipType,
        role: input.role,
        department: input.department,
        start_date: BigInt(input.startAt),
        end_date: BigInt(input.endAt),
        public_display: input.publicDisplay,
        detail_hash: prepared.detailHash,
      },
      methodOptions,
    ),
  );
}

export async function submitMandate(
  prepared: PreparedClaim<MandateInput>,
): Promise<WriteReceipt<bigint>> {
  const { input } = prepared;
  return submitResult(input.caller, input.actor.id, (client) =>
    client.issue_mandate(
      {
        caller: input.caller,
        org: entityId(input.organisation.id, "Organisation"),
        representative: entityId(input.representative.id, "Representative"),
        relationship: input.relationshipId ? entityId(input.relationshipId, "Relationship") : 0n,
        mandate_type: input.mandateType,
        scope: input.scope,
        territory: input.territory,
        valid_from: BigInt(input.validFrom),
        valid_until: BigInt(input.validUntil),
        detail_hash: prepared.detailHash,
      },
      methodOptions,
    ),
  );
}

export async function submitWithdrawal(prepared: PreparedWithdrawal): Promise<WriteReceipt<void>> {
  const { input } = prepared;
  return submitResult(input.caller, input.actor.id, (client) => {
    const args = {
      caller: input.caller,
      id: entityId(input.claim.id, "Claim"),
      status: ClaimStatus.Withdrawn,
    };
    return input.claim.kind === "relationship"
      ? client.set_relationship_status(args, methodOptions)
      : client.set_mandate_status(args, methodOptions);
  });
}

export async function submitPublication(
  prepared: PreparedPublication,
): Promise<WriteReceipt<void>> {
  const { input } = prepared;
  return submitResult(input.caller, input.actor.id, (client) =>
    client.set_public_display(
      {
        caller: input.caller,
        id: entityId(input.claim.id, "Claim"),
        public_display: input.publicDisplay,
      },
      methodOptions,
    ),
  );
}

const methodOptions = {
  restore: false,
  timeoutInSeconds: WRITE_TIMEOUT_SECONDS,
} as const;

async function submitResult<T>(
  expectedAddress: string,
  expectedEntityId: string,
  build: (client: Client) => Promise<AssembledTransaction<Result<T>>>,
): Promise<WriteReceipt<T>> {
  try {
    const address = normalizeAddress(expectedAddress);
    await verifyWalletAndController(address, expectedEntityId);
    const client = writeClient(address);
    const transaction = await build(client);

    // Simulation is a free preflight. Contract errors are surfaced before the
    // wallet receives a signing request.
    unwrapContractResult(transaction.result);
    const extraSigners = transaction.needsNonInvokerSigningBy();
    if (extraSigners.length > 0) {
      throw new WriteFailure(
        "wallet",
        `This transaction unexpectedly requires another signer (${extraSigners.join(", ")}). Nothing was submitted.`,
      );
    }

    const sent = await transaction.signAndSend();
    const response = sent.getTransactionResponse;
    if (!response || response.status !== "SUCCESS" || !("ledger" in response)) {
      throw new WriteFailure(
        "submission",
        "The transaction was submitted but final ledger success was not confirmed. Check its hash before retrying.",
      );
    }
    const result = unwrapContractResult(sent.result);
    const hash = response.txHash || sent.sendTransactionResponse?.hash;
    if (!hash) {
      throw new WriteFailure(
        "submission",
        "The ledger confirmed the transaction, but the RPC returned no transaction hash.",
      );
    }

    return {
      result,
      hash,
      ledger: response.ledger,
      explorerUrl: transactionExplorerUrl(hash),
    };
  } catch (cause) {
    throw normalizeWriteFailure(cause);
  }
}

function writeClient(expectedAddress: string): Client {
  return new Client({
    contractId: chainConfig.contractId,
    networkPassphrase: chainConfig.networkPassphrase,
    rpcUrl: chainConfig.rpcUrl,
    allowHttp: chainConfig.rpcUrl.startsWith("http://"),
    publicKey: expectedAddress,
    signTransaction: freighterSigner(expectedAddress),
  });
}

function freighterSigner(expectedAddress: string): SignTransaction {
  return async (transactionXdr, options) => {
    if (
      options?.networkPassphrase &&
      options.networkPassphrase !== chainConfig.networkPassphrase
    ) {
      throw new WriteFailure(
        "network",
        "The transaction network does not match the configured registry network.",
      );
    }

    const signed = await freighterSignTransaction(transactionXdr, {
      networkPassphrase: chainConfig.networkPassphrase,
      address: expectedAddress,
    });
    if (signed.error) return signed;
    if (!signed.signedTxXdr) {
      throw new WriteFailure("wallet", "Freighter returned no signed transaction.");
    }
    if (normalizeAddress(signed.signerAddress) !== expectedAddress) {
      throw new WriteFailure(
        "controller",
        "Freighter signed with a different account. Nothing was submitted.",
      );
    }
    return signed;
  };
}

async function verifyWalletAndController(expectedAddress: string, expectedEntityId: string) {
  const network = await getNetwork();
  if (network.error) {
    throw new WriteFailure("wallet", network.error.message || "Could not read the Freighter network.");
  }
  if (network.networkPassphrase !== chainConfig.networkPassphrase) {
    throw new WriteFailure(
      "network",
      `Freighter is on ${network.network || "another network"}. Switch it to the registry network before signing.`,
    );
  }

  const account = await getAddress();
  if (account.error || !account.address) {
    throw new WriteFailure(
      "wallet",
      account.error?.message || "Freighter did not provide a connected account.",
    );
  }
  if (normalizeAddress(account.address) !== expectedAddress) {
    throw new WriteFailure(
      "controller",
      "The active Freighter account changed. Reconnect before preparing this transaction.",
    );
  }

  const entity = await read(registry().get_entity_by_controller({ controller: expectedAddress }));
  if (!entity || entity.id.toString() !== expectedEntityId) {
    throw new WriteFailure(
      "controller",
      "The connected account is not the current on-chain controller of this badge.",
    );
  }
}

function unwrapContractResult<T>(result: Result<T>): T {
  if (result.isErr()) {
    throw new WriteFailure("contract", `The registry rejected this write: ${result.unwrapErr().message}.`);
  }
  return result.unwrap();
}

function normalizeWriteFailure(cause: unknown): WriteFailure {
  if (cause instanceof WriteFailure) return cause;
  const raw = cause instanceof Error ? cause.message : String(cause);
  const message = safeErrorText(raw);

  if (/reject|declin|denied|cancel|dismiss|user closed/i.test(message)) {
    return new WriteFailure("rejected", "The signing request was dismissed. Nothing was submitted.");
  }
  if (/account.*not found|source account|unfunded|does not exist|404/i.test(message)) {
    return new WriteFailure(
      "unfunded",
      "The connected Stellar account is not funded on this network, so it cannot pay transaction fees.",
    );
  }
  if (/archiv|restorefootprint|expired state/i.test(message)) {
    return new WriteFailure(
      "archived",
      "Required registry data is archived. Nothing was submitted; an operator must restore it first.",
    );
  }

  const contractCode = message.match(/Error\(Contract,\s*#(\d+)\)/i)?.[1];
  if (contractCode) {
    const label = CONTRACT_ERROR_LABELS[Number(contractCode)] ?? `contract error #${contractCode}`;
    return new WriteFailure("contract", `The registry rejected this write: ${label}.`);
  }
  if (/notauthorized|entitynotactive|invaliddaterange|invalidstatus|relationshipmismatch|paused/i.test(message)) {
    return new WriteFailure("contract", `The registry rejected this write: ${message}.`);
  }
  if (/simulate|hosterror|soroban|transaction construction/i.test(message)) {
    return new WriteFailure(
      "simulation",
      `The transaction failed its Stellar simulation and was not submitted. ${message}`,
    );
  }
  if (/timeout|still pending|try again later/i.test(message)) {
    return new WriteFailure(
      "submission",
      "Ledger confirmation timed out. Check the transaction in an explorer before trying again.",
    );
  }
  return new WriteFailure(
    "submission",
    `The transaction was not confirmed as successful. ${message || "No diagnostic was returned."}`,
  );
}

const CONTRACT_ERROR_LABELS: Record<number, string> = {
  3: "not authorised",
  4: "registry paused",
  10: "entity not found",
  14: "public text is too long",
  15: "entity is not active",
  16: "wrong entity kind",
  20: "claim not found",
  21: "invalid date range",
  22: "invalid status transition",
  23: "relationship does not match these parties",
  24: "an expiry is required",
  25: "the requested validity window is too long",
  26: "personal descriptive data is not allowed on-chain",
  27: "invalid credential URI",
  28: "public text contains unsafe control characters",
  29: "invalid zero hash",
  30: "this pair already has the maximum number of live or scheduled confirmed mandates",
  35: "invalid controller acceptance window",
  37: "the issuer has not approved this exact controller recovery",
  38: "an organisation cannot mandate itself",
};

function assertActor(actor: Entity, caller: string) {
  if (normalizeAddress(actor.controller) !== caller) {
    throw new WriteFailure("controller", "The connected account does not control this badge.");
  }
}

function assertRelationshipAuthority(actor: Entity, organisation: Organisation, person: Person) {
  const valid =
    (actor.kind === "organisation" && actor.id === organisation.id) ||
    (actor.kind === "person" && actor.id === person.id);
  if (!valid) {
    throw new WriteFailure("controller", "This badge cannot make that relationship statement.");
  }
}

function assertMandateAuthority(actor: Entity, organisation: Organisation, representative: Entity) {
  if (organisation.id === representative.id) {
    throw new WriteFailure("contract", "An organisation cannot issue a representation mandate to itself.");
  }
  const valid =
    actor.id === organisation.id || actor.id === representative.id;
  if (!valid) {
    throw new WriteFailure("controller", "This badge cannot make that mandate statement.");
  }
}

function assertWithdrawalAuthority(actor: Entity, claim: HolderClaim) {
  const valid = actor.id === claim.organisationId || actor.id === claim.subjectId;
  if (!valid) {
    throw new WriteFailure("controller", "This badge is not a party to that claim.");
  }
}

function assertPublicationAuthority(actor: Person, claim: HolderClaim) {
  if (claim.kind !== "relationship" || actor.id !== claim.subjectId) {
    throw new WriteFailure(
      "controller",
      "Only the person named by a relationship can change its verifier listing.",
    );
  }
}

function requiredText(value: string, label: string): string {
  const normalized = optionalText(value, label);
  if (!normalized) throw new WriteFailure("contract", `${label} is required.`);
  return normalized;
}

function optionalText(value: string, label: string): string {
  const normalized = value.normalize("NFC").trim();
  if (new TextEncoder().encode(normalized).length > MAX_TEXT_BYTES) {
    throw new WriteFailure("contract", `${label} must be at most ${MAX_TEXT_BYTES} UTF-8 bytes.`);
  }
  if (/\p{Cc}|\p{Cf}/u.test(normalized)) {
    throw new WriteFailure("contract", `${label} cannot contain control or hidden formatting characters.`);
  }
  return normalized;
}

function timestamp(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new WriteFailure("contract", `${label} is invalid.`);
  }
  return value;
}

function entityId(value: string, label: string): bigint {
  return BigInt(idString(value, label));
}

function idString(value: string, label: string): string {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new WriteFailure("contract", `${label} id is invalid.`);
  }
  return value;
}

function compareDecimalIds(left: string, right: string): number {
  const a = BigInt(left);
  const b = BigInt(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase();
}

function entityLabel(entity: Entity): string {
  return `${quote(entity.name || entity.handle)} (@${entity.handle}, entity #${entity.id})`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function transactionExplorerUrl(hash: string): string {
  const network = chainConfig.networkPassphrase.includes("Test SDF") ? "testnet" : "public";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

function safeErrorText(value: string): string {
  return value
    .replace(/[A-Za-z0-9+/=_-]{120,}/g, "[encoded transaction data]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);
}

async function sha256(value: string): Promise<Buffer> {
  if (!globalThis.crypto?.subtle) {
    throw new WriteFailure("simulation", "This browser cannot create the required SHA-256 statement hash.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(new Uint8Array(digest));
}

/** JSON Canonicalization Scheme-style key ordering for this simple payload. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError("Canonical statement numbers must be safe integers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError("Unsupported canonical statement value");
}
