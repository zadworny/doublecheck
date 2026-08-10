/**
 * Optional Freighter connection, used for exactly one thing: finding out which
 * badge belongs to the reader.
 *
 * Nothing in the verifier requires this. Every read stays a free simulation
 * against a public registry, and a candidate checking a recruiter is never
 * asked to install anything — see `chain.ts`. Connecting is a convenience for
 * the *other* audience: someone who holds a badge and wants to see their own
 * record without knowing their entity id.
 *
 * The connection itself is deliberately **not** authentication. It only reads
 * a public address. The holder console separately re-checks the live account,
 * network, and on-chain controller, then requires Freighter to sign the exact
 * Soroban transaction before any privileged write can occur.
 */

import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { chainConfig } from "./chain";

export type WalletError =
  /** Freighter is not installed, or is not exposing itself to the page. */
  | "not-installed"
  /** The user dismissed or rejected the connection prompt. */
  | "rejected"
  /** Connected, but the wallet is pointed at a different Stellar network. */
  | "wrong-network"
  | "unknown";

export interface WalletFailure {
  error: WalletError;
  /** Freighter's own message, when it gave one worth surfacing. */
  detail?: string;
}

/**
 * Pulls a readable string out of whatever Freighter handed back.
 *
 * Its errors are `{ code, message }` objects, not strings — stringifying one
 * directly yields "[object Object]", which is how this surfaced in the UI.
 */
function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { message } = error as { message?: unknown };
    if (typeof message === "string" && message.trim()) return message;
  }
  return "";
}

/**
 * True when the user closed or declined the prompt.
 *
 * Freighter signals this through the extension rather than the SDK's own error
 * table, so match on the message text and treat a missing address as the same
 * thing — both mean "no approval given", which is a choice, not a fault.
 */
function looksRejected(error: unknown): boolean {
  const message = describeError(error);
  return /declin|denied|reject|cancel|dismiss|not allowed|user closed/i.test(message);
}

export interface WalletAccount {
  address: string;
  /** Freighter's label for its active network, e.g. "TESTNET". */
  network: string;
}

export type WalletResult = WalletAccount | WalletFailure;

export function isFailure(result: WalletResult): result is WalletFailure {
  return "error" in result;
}

export const FREIGHTER_URL = "https://www.freighter.app/";

/** True when the extension is present. Cheap, and never prompts. */
export async function walletAvailable(): Promise<boolean> {
  try {
    const { isConnected: present } = await isConnected();
    return present;
  } catch {
    return false;
  }
}

/**
 * Confirms the wallet is on the same network as the contract we read.
 *
 * A Freighter pointed at mainnet would hand back an address that cannot match
 * anything in a testnet registry, which would otherwise surface as a confusing
 * "no badge found" rather than the real problem.
 */
async function checkNetwork(): Promise<{ network: string } | WalletFailure> {
  const { network, networkPassphrase, error } = await getNetwork();
  if (error) return { error: "unknown", detail: describeError(error) };
  if (networkPassphrase !== chainConfig.networkPassphrase) {
    return { error: "wrong-network", detail: network };
  }
  return { network };
}

async function withNetwork(address: string): Promise<WalletResult> {
  const net = await checkNetwork();
  if ("error" in net) return net;
  return { address, network: net.network };
}

/**
 * Reconnects silently on load if the user already approved this site.
 *
 * Returns null when there is nothing to restore, so a first-time visitor never
 * sees a prompt they did not ask for.
 */
export async function restoreConnection(): Promise<WalletResult | null> {
  try {
    if (!(await walletAvailable())) return null;
    const { isAllowed: allowed } = await isAllowed();
    if (!allowed) return null;

    const { address, error } = await getAddress();
    if (error || !address) return null;
    return await withNetwork(address);
  } catch {
    return null;
  }
}

/** Prompts for access. Only ever call this from a user gesture. */
export async function connectWallet(): Promise<WalletResult> {
  try {
    if (!(await walletAvailable())) return { error: "not-installed" };

    const { address, error } = await requestAccess();
    if (error) {
      if (looksRejected(error)) return { error: "rejected" };
      return { error: "unknown", detail: describeError(error) };
    }
    // No address and no error means the prompt was closed without approving.
    if (!address) return { error: "rejected" };

    return await withNetwork(address);
  } catch (cause) {
    if (looksRejected(cause)) return { error: "rejected" };
    return { error: "unknown", detail: describeError(cause) };
  }
}

export function walletErrorMessage(failure: WalletFailure): string {
  switch (failure.error) {
    case "not-installed":
      return "No Freighter wallet detected in this browser.";
    case "rejected":
      return "Connection request was dismissed.";
    case "wrong-network":
      return `Freighter is on ${failure.detail ?? "another network"}, but this registry lives on ${
        chainConfig.networkPassphrase.includes("Test SDF") ? "Testnet" : "Mainnet"
      }. Switch networks in Freighter and reconnect.`;
    default:
      // `detail` may be empty when the cause carried no message.
      return failure.detail?.trim() || "Could not reach the wallet.";
  }
}
