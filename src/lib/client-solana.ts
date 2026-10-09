import { Buffer } from "buffer";
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
export type BuiltInstruction = { programId: string; data: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[] };
export function compileInstructions(instructions: BuiltInstruction[], wallet: PublicKey, recentBlockhash: string) {
  const compiled = instructions.map(ix => new TransactionInstruction({ programId: new PublicKey(ix.programId), keys: ix.accounts.map(account => ({ pubkey: new PublicKey(account.pubkey), isSigner: account.isSigner, isWritable: account.isWritable })), data: Buffer.from(ix.data, "base64") }));
  return new VersionedTransaction(new TransactionMessage({ payerKey: wallet, recentBlockhash, instructions: compiled }).compileToV0Message());
}
export function deserializeCreate(transaction: string) { return VersionedTransaction.deserialize(Buffer.from(transaction, "base64")); }
