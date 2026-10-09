import "server-only";
import { Connection } from "@solana/web3.js";
import type { BuiltInstruction } from "./client-solana";
import { expectedCreateMessage, expectedInstructionMessage, transactionMatchesBuild } from "./transaction-policy";

type ChainResult = "pending" | "confirmed" | "failed" | "mismatch";

export async function verifyInstructionTransaction(
  rpcUrl: string,
  signature: string,
  wallet: string,
  build: { instructions: BuiltInstruction[]; recentBlockhash: string },
): Promise<ChainResult> {
  return verifyMessage(rpcUrl, signature, expectedInstructionMessage(wallet, build.instructions, build.recentBlockhash));
}

export async function verifyCreateTransaction(rpcUrl: string, signature: string, serializedBuild: string): Promise<ChainResult> {
  return verifyMessage(rpcUrl, signature, expectedCreateMessage(serializedBuild));
}

async function verifyMessage(rpcUrl: string, signature: string, expectedMessage: Uint8Array): Promise<ChainResult> {
  const transaction = await new Connection(rpcUrl, "confirmed").getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction) return "pending";
  if (!transactionMatchesBuild(signature, expectedMessage, transaction.transaction)) return "mismatch";
  if (!transaction.meta) return "pending";
  return transaction.meta.err ? "failed" : "confirmed";
}
