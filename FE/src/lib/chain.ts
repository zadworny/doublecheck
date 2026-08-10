/**
 * Connection to the DoubleCheck registry contract on Stellar.
 *
 * Public verifier reads are *simulated* rather than submitted: no transaction,
 * signature, fee, or wallet. Holder-initiated writes use a separate client in
 * `write.ts`; a candidate checking a recruiter is never asked to install or
 * connect anything.
 */

import { Client, networks } from "../contract/registry";

const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? networks.testnet.contractId;
const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? networks.testnet.networkPassphrase;

export const chainConfig = {
  rpcUrl: RPC_URL,
  contractId: CONTRACT_ID,
  networkPassphrase: NETWORK_PASSPHRASE,
  /** stellar.expert link for the contract, shown in the footer. */
  explorerUrl: `https://stellar.expert/explorer/${
    NETWORK_PASSPHRASE === networks.testnet.networkPassphrase ? "testnet" : "public"
  }/contract/${CONTRACT_ID}`,
} as const;

let client: Client | undefined;

export function registry(): Client {
  client ??= new Client({
    contractId: chainConfig.contractId,
    networkPassphrase: chainConfig.networkPassphrase,
    rpcUrl: chainConfig.rpcUrl,
    // Deliberately omit `publicKey`: the generated SDK then uses its internal
    // simulation-only null account. Supplying the impossible GAAAA… address
    // would make it try (and fail) to load that account from Horizon/RPC first.
    allowHttp: RPC_URL.startsWith("http://"),
  });
  return client;
}

/** Unwraps a simulated read. The bindings model every call as a transaction. */
export async function read<T>(call: Promise<{ result: T }>): Promise<T> {
  return (await call).result;
}

/** Contract timestamps are Unix seconds as `bigint`; the UI wants ISO strings. */
export function tsToIso(seconds: bigint | number): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

/** `0` is the contract's "not set" for optional dates (ongoing, no expiry). */
export function optionalTsToIso(seconds: bigint | number): string | null {
  return Number(seconds) === 0 ? null : tsToIso(seconds);
}
