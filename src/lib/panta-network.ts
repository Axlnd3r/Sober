import "server-only";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "node:buffer";
import type { BuiltInstruction } from "./client-solana";
import { assertInstructionPolicy } from "./transaction-policy";

export function transactionPolicyConfigured() {
  return Boolean(process.env.PANTA_EXPECTED_GENESIS_HASH && process.env.PANTA_USDC_MINT && process.env.PANTA_PROGRAM_IDS);
}
export async function validatePantaInstructions(wallet: string, marketId: string, instructions: BuiltInstruction[], creating = false) {
  const expectedGenesis = process.env.PANTA_EXPECTED_GENESIS_HASH;
  const mint = process.env.PANTA_USDC_MINT;
  const programs = (process.env.PANTA_PROGRAM_IDS || "").split(",").map(p => p.trim()).filter(Boolean);
  if (!expectedGenesis || !mint || !programs.length || !process.env.SOLANA_RPC_URL || !process.env.NEXT_PUBLIC_SOLANA_RPC_URL) throw new Error("Panta transaction policy is not configured");
  assertInstructionPolicy(wallet, marketId, mint, programs, instructions);
  const rpc = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
  const browserRpc = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, "confirmed");
  const [serverGenesis, browserGenesis, marketAccount, mintAccount] = await Promise.all([
    rpc.getGenesisHash(), browserRpc.getGenesisHash(), rpc.getAccountInfo(new PublicKey(marketId)), rpc.getParsedAccountInfo(new PublicKey(mint)),
  ]);
  if (serverGenesis !== expectedGenesis || browserGenesis !== expectedGenesis) throw new Error("Solana RPC network does not match the reviewed Panta deployment");
  if (!creating && (!marketAccount || !programs.includes(marketAccount.owner.toBase58()) || !instructions.some(i => i.programId === marketAccount.owner.toBase58() && i.accounts.some(a => a.pubkey === marketId)))) throw new Error("Market account does not belong to the reviewed Panta program");
  const mintData = mintAccount.value?.data;
  if (!mintData || !("parsed" in mintData) || mintData.parsed.type !== "mint" || mintData.parsed.info.decimals !== 6) throw new Error("Configured USDC mint is unavailable or incompatible on this network");
}
export async function validatePantaCreate(wallet: string, marketId: string, serialized: string) {
  const tx = VersionedTransaction.deserialize(Buffer.from(serialized, "base64"));
  if (tx.message.addressTableLookups.length) throw new Error("Create transactions with lookup tables need policy review");
  const instructions = tx.message.compiledInstructions.map(i => ({ programId: tx.message.staticAccountKeys[i.programIdIndex].toBase58(), data: Buffer.from(i.data).toString("base64"), accounts: Array.from(i.accountKeyIndexes, index => ({ pubkey: tx.message.staticAccountKeys[index].toBase58(), isSigner: tx.message.isAccountSigner(index), isWritable: tx.message.isAccountWritable(index) })) }));
  await validatePantaInstructions(wallet, marketId, instructions, true);
}
