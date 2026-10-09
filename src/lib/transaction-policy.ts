import { Buffer } from "node:buffer";
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { BuiltInstruction } from "./client-solana";

export function assertInstructionPolicy(wallet: string, market: string, mint: string, allowedPrograms: string[], instructions: BuiltInstruction[]) {
  if (!instructions.length || !allowedPrograms.length) throw new Error("Missing reviewed Panta instructions or programs");
  for (const instruction of instructions) {
    if (!allowedPrograms.includes(instruction.programId)) throw new Error("Transaction contains an unreviewed program");
    if (instruction.accounts.some(account => account.isSigner && account.pubkey !== wallet)) throw new Error("Transaction requires an unsupported signer");
  }
  if (!instructions.some(i => i.accounts.some(a => a.pubkey === market))) throw new Error("Transaction does not reference the expected market");
  if (!instructions.some(i => i.accounts.some(a => a.pubkey === mint))) throw new Error("Transaction does not reference the reviewed USDC mint");
}

export function expectedInstructionMessage(wallet: string, instructions: BuiltInstruction[], recentBlockhash: string) {
  const items = instructions.map((instruction) => new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  }));
  return new TransactionMessage({ payerKey: new PublicKey(wallet), recentBlockhash, instructions: items }).compileToV0Message().serialize();
}

export function expectedCreateMessage(serializedBuild: string) {
  return VersionedTransaction.deserialize(Buffer.from(serializedBuild, "base64")).message.serialize();
}

export function transactionMatchesBuild(signature: string, expectedMessage: Uint8Array, transaction: {
  signatures: string[];
  message: { serialize(): Uint8Array };
}) {
  return transaction.signatures[0] === signature && Buffer.from(transaction.message.serialize()).equals(Buffer.from(expectedMessage));
}
