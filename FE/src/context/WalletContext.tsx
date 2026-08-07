import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet,
  isFailure,
  restoreConnection,
  walletAvailable,
  type WalletFailure,
} from "../lib/wallet";

interface WalletContextValue {
  /** Connected address, or null. Never blocks anything — reads work regardless. */
  address: string | null;
  /** Freighter's active network label, once connected. */
  network: string | null;
  /** True while a connect attempt is in flight. */
  connecting: boolean;
  /** Last failure, cleared on the next attempt. */
  failure: WalletFailure | null;
  /** False when the extension is absent, so the UI can link to install instead. */
  available: boolean;
  connect(): Promise<void>;
  /** Forgets the address locally. See the note below — this is not a revoke. */
  disconnect(): void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/** Remembers only that a connection was wanted; the address is re-read from
 * Freighter on load rather than trusted from storage. */
const STORAGE_KEY = "doublecheck-wallet-connected";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [failure, setFailure] = useState<WalletFailure | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void walletAvailable().then((present) => {
      if (!cancelled) setAvailable(present);
    });

    // Only auto-reconnect if this browser connected before, so a first visit is
    // never interrupted by a wallet prompt.
    if (window.localStorage.getItem(STORAGE_KEY) !== "1") return;

    void restoreConnection().then((result) => {
      if (cancelled || !result) return;
      if (isFailure(result)) {
        setFailure(result);
        return;
      }
      setAddress(result.address);
      setNetwork(result.network);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setFailure(null);
    const result = await connectWallet();
    if (isFailure(result)) {
      setFailure(result);
      if (result.error === "not-installed") setAvailable(false);
    } else {
      setAddress(result.address);
      setNetwork(result.network);
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    // Freighter exposes no revoke API — this only forgets the address in this
    // tab and stops auto-reconnecting. The site stays on the wallet's allowed
    // list until the user removes it in Freighter itself.
    setAddress(null);
    setNetwork(null);
    setFailure(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ address, network, connecting, failure, available, connect, disconnect }),
    [address, network, connecting, failure, available, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
