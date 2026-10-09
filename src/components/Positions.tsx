"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { api, post } from "@/lib/client-api";
import { compileInstructions, type BuiltInstruction } from "@/lib/client-solana";
import { useSoberSession } from "./Shell";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";
type Position = { marketId: string; side: string; shares: string; phase: string; claimable: boolean; claimed: boolean; outcome?: string | null };
type ClaimBuild = { wallet: string; marketId: string; outcome: string; winningShares: string; instructions: BuiltInstruction[]; recentBlockhash: string; lastValidBlockHeight?: number };
type ClaimStatus = { state: string; signature: string; chainStatus: string; attributionStatus: string; indexed: boolean };
export function Positions() {
  const { session, mode } = useSoberSession();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<{ intentId: string; build: ClaimBuild } | null>(null);
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [pendingSignature, setPendingSignature] = useState("");
  const [message, setMessage] = useState("");
  const address = wallet.publicKey?.toBase58();
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (mode !== "live" || !session?.wallet || session.wallet !== address) return;
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController(); request.current = controller;
    setRefreshing(true);
    try {
      setError("");
      const result = await api<{ positions: Position[] }>("/api/positions", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPositions(result.positions); setCheckedAt(new Date().toISOString());
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load positions"); }
    finally { if (request.current === controller && !controller.signal.aborted) { request.current = null; setLoading(false); setRefreshing(false); } }
  }, [mode, session?.wallet, address]);
  useEffect(() => {
    request.current?.abort(); setPositions([]); setCheckedAt(null); setLoading(true);
    void load();
    return () => request.current?.abort();
  }, [load]);
  const refresh = useCallback(() => { void load(); }, [load]);
  useVisibleRefresh(refresh, !busy && !pendingSignature && !claim);
  async function prepare(marketId: string) { if (pendingSignature) return; setBusy(true); setError(""); try { const result = await post<{ intentId: string; build: ClaimBuild }>("/api/claims/build", { marketId, idempotencyKey: crypto.randomUUID() }); setClaim(result); setStatus(null); setMessage("Panta rechecked eligibility. Review the claim before signing."); } catch (e) { setError(e instanceof Error ? e.message : "Claim unavailable"); } finally { setBusy(false); } }
  async function signClaim() {
    if (!claim || !wallet.publicKey || !wallet.signTransaction || pendingSignature) return;
    setBusy(true); setError("");
    try {
      const tx = compileInstructions(claim.build.instructions, wallet.publicKey, claim.build.recentBlockhash);
      const signed = await wallet.signTransaction(tx);
      const signature = bs58.encode(signed.signatures[0]);
      sessionStorage.setItem("sober:pending-claim", JSON.stringify({ intentId: claim.intentId, signature, wallet: wallet.publicKey.toBase58(), marketId: claim.build.marketId }));
      setPendingSignature(signature);
      await post("/api/claims/signed", { intentId: claim.intentId, signature });
      try { await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" }); setMessage("Claim sent. Checking chain and Panta indexing."); }
      catch { setMessage("Broadcast result unknown. Check this signature before trying again."); }
      await check(claim.intentId);
    } catch (e) { setError(e instanceof Error ? e.message : "Wallet rejected or claim failed"); }
    finally { setBusy(false); }
  }
  async function check(id: string) { try { const result = await api<ClaimStatus>(`/api/claims/intent/${id}`); setStatus(result); if (result.indexed) { sessionStorage.removeItem("sober:pending-claim"); setPendingSignature(""); await load(); } else if (result.chainStatus === "failed") { sessionStorage.removeItem("sober:pending-claim"); setPendingSignature(""); setClaim(null); setMessage("Claim failed on chain. Build a fresh claim after checking eligibility."); } else if (result.chainStatus === "mismatch") { setError("The confirmed transaction does not match this claim. Do not retry it. Contact support with the signature."); } } catch (e) { setError(e instanceof Error ? e.message : "Status unavailable"); } }
  useEffect(() => { try { const marker = JSON.parse(sessionStorage.getItem("sober:pending-claim") || "null"); if (marker?.wallet === wallet.publicKey?.toBase58()) { setPendingSignature(marker.signature); setMessage(`Pending claim signature: ${marker.signature}`); void check(marker.intentId); } } catch { /* ignore damaged marker */ } }, [wallet.publicKey]);
  return <div className="container utility-page"><div className="page-heading"><span className="eyebrow">WALLET / PANTA</span><h1>Your positions. In focus.</h1><p>See holdings linked to Sober football rooms and check claim eligibility with Panta. A finished match does not automatically make a position claimable.</p></div>
    {mode === "simulation" ? <div className="empty-panel"><h2>Demo mode</h2><p>This preview has no real wallet holdings or claim transactions.</p><Link className="button-primary" href="/matches">Explore the sample room <ArrowRight size={17}/></Link></div> : !session?.wallet || !wallet.publicKey || session.wallet !== wallet.publicKey.toBase58() ? <div className="empty-panel"><h2>Connect and sign in</h2><p>Use the wallet control in the header to view your Panta positions.</p></div> : <>
      <div className="utility-toolbar"><span>{loading ? "Loading positions" : `${positions.length} positions${checkedAt ? ` · Checked ${new Date(checkedAt).toLocaleTimeString()}` : ""}`}</span><button className="button-secondary" disabled={refreshing} onClick={() => void load()}><RefreshCw size={15}/> {refreshing ? "Checking…" : "Refresh"}</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="empty-panel" role="status"><h2>Loading positions</h2><p>Checking Panta holdings for this wallet.</p></div> : positions.length ? <div className="position-list">{positions.map((position, index) => <article className="position-card" key={`${position.marketId}-${position.side}-${index}`}><div><span className="eyebrow">PANTA MARKET</span><h2>{position.marketId.slice(0, 7)}…{position.marketId.slice(-7)}</h2><p>Phase: {position.phase} · Outcome: {position.outcome || "Pending"}</p></div><dl><div><dt>Side</dt><dd>{position.side.toUpperCase()}</dd></div><div><dt>Shares</dt><dd>{position.shares}</dd></div><div><dt>Claim</dt><dd>{position.claimed ? "Claimed" : position.claimable ? "Eligible" : "Not eligible"}</dd></div></dl><button className="button-primary" disabled={busy || Boolean(pendingSignature) || !position.claimable || position.claimed} onClick={() => void prepare(position.marketId)}>{position.claimed ? "Claimed" : position.claimable ? "Build claim" : "Not claimable"}</button></article>)}</div> : !error && <div className="empty-panel"><h2>No Sober football positions found</h2><p>No Panta holdings are linked to a Sober football room for this wallet.</p><Link className="button-primary" href="/matches">See matches <ArrowRight size={17}/></Link></div>}
    </>}
    {claim && <div className="claim-review"><span className="eyebrow">CLAIM REVIEW</span><h2>Ready for wallet approval</h2><p>Winning shares: {claim.build.winningShares} · Outcome: {claim.build.outcome}</p><p>Market: {claim.build.marketId}</p><button className="button-primary" disabled={busy || Boolean(pendingSignature) || Boolean(status?.indexed) || status?.state === "failed" || status?.chainStatus === "mismatch"} onClick={() => void signClaim()}>{pendingSignature ? "Signature recorded" : busy ? "Working…" : "Sign and send claim"}</button><button className="button-secondary" onClick={() => void check(claim.intentId)}>Check status</button></div>}
    {message && <p className="inline-feedback" role="status">{message}</p>}{status && <div className="claim-review"><strong>Chain: {status.chainStatus}</strong><p>{status.indexed ? "Panta position updated." : status.chainStatus === "confirmed" ? "Claim confirmed on chain. Panta is updating the position." : "Claim is pending."}</p><code>{status.signature}</code></div>}
    <p className="powered-note">Powered by <a href="https://www.panta.market/" target="_blank" rel="noreferrer">Panta <ExternalLink size={13}/></a></p>
  </div>;
}
