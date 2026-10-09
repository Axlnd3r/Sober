"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { LogOut, Wallet } from "lucide-react";
import { api, post } from "@/lib/client-api";

type SignedSession = { wallet: string; admin: boolean; expiresAt: string };

export function useSoberSession() {
  const [session, setSession] = useState<SignedSession | null>(null);
  const [mode, setMode] = useState<"unknown" | "simulation" | "live">("unknown");
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ session: SignedSession | null; mode: "simulation" | "live" }>("/api/auth/session");
      setSession(data.session);
      setMode(data.mode);
    } catch {
      setSession(null);
      setMode("unknown");
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("sober:session-changed", refresh);
    return () => window.removeEventListener("sober:session-changed", refresh);
  }, [refresh]);
  return { session, mode, refresh };
}

export function WalletControl() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const { session, mode } = useSoberSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (!wallet.publicKey || !wallet.signMessage) return;
    setBusy(true); setError("");
    try {
      const nonce = await post<{ nonceId: string; message: string }>("/api/auth/nonce", { wallet: wallet.publicKey.toBase58() });
      const signed = await wallet.signMessage(new TextEncoder().encode(nonce.message));
      await post("/api/auth/verify", { nonceId: nonce.nonceId, signature: bs58.encode(signed) });
      window.dispatchEvent(new Event("sober:session-changed"));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in"); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    if (session) await post("/api/auth/logout", {}).catch(() => undefined);
    await wallet.disconnect();
    window.dispatchEvent(new Event("sober:session-changed"));
  }

  const address = wallet.publicKey?.toBase58();
  return <div className="wallet-control">
    {mode === "simulation" && <span className="mode-chip">DEMO MODE</span>}
    {!wallet.connected ? <button className="wallet-button" aria-label="Connect wallet" onClick={() => modal.setVisible(true)}><Wallet size={17} /> <span>Connect wallet</span></button> :
      <div className="wallet-connected"><span className="wallet-address">{address?.slice(0, 4)}…{address?.slice(-4)}</span>
        {mode === "live" && session?.wallet !== address && <button className="text-button" disabled={busy || !wallet.signMessage} onClick={() => void signIn()}>{busy ? "Signing…" : "Sign in"}</button>}
        {mode === "live" && session?.wallet === address && <span className="signed-badge">Signed in</span>}
        <button className="icon-button" title="Disconnect wallet" aria-label="Disconnect wallet" onClick={() => void disconnect()}><LogOut size={16} /></button>
      </div>}
    {error && <div className="wallet-error" role="alert">{error}</div>}
  </div>;
}
