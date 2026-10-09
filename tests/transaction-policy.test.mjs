import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { expectedCreateMessage, expectedInstructionMessage, transactionMatchesBuild, assertInstructionPolicy } from "../src/lib/transaction-policy.ts";
import { formatUsdcBaseUnits, parseUsdcToBaseUnits, unixSeconds } from "../src/lib/money.ts";

test("a chain signature only matches the exact built message and first signature", () => {
  const payer = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const blockhash = bs58.encode(Buffer.alloc(32, 7));
  const transfer = SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient, lamports: 100 });
  const built = [{
    programId: transfer.programId.toBase58(),
    accounts: transfer.keys.map((key) => ({ pubkey: key.pubkey.toBase58(), isSigner: key.isSigner, isWritable: key.isWritable })),
    data: Buffer.from(transfer.data).toString("base64"),
  }];
  const transaction = new VersionedTransaction(new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: [transfer] }).compileToV0Message());
  transaction.sign([payer]);
  const signature = bs58.encode(transaction.signatures[0]);
  const expected = expectedInstructionMessage(payer.publicKey.toBase58(), built, blockhash);
  const response = { signatures: [signature], message: transaction.message };

  assert.equal(transactionMatchesBuild(signature, expected, response), true);
  assert.equal(transactionMatchesBuild(bs58.encode(Buffer.alloc(64, 1)), expected, response), false);
  assert.equal(transactionMatchesBuild(signature, expectedInstructionMessage(Keypair.generate().publicKey.toBase58(), built, blockhash), response), false);

  const changedTransfer = SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient, lamports: 101 });
  const changed = [{ ...built[0], data: Buffer.from(changedTransfer.data).toString("base64") }];
  assert.equal(transactionMatchesBuild(signature, expectedInstructionMessage(payer.publicKey.toBase58(), changed, blockhash), response), false);
  assert.equal(transactionMatchesBuild(signature, expectedCreateMessage(Buffer.from(transaction.serialize()).toString("base64")), response), true);
});

test("USDC parsing stays exact at six decimals and rejects nondecimal input", () => {
  assert.equal(parseUsdcToBaseUnits("1.234567"), 1_234_567n);
  assert.equal(formatUsdcBaseUnits(1_234_567n), "1.234567");
  for (const value of ["0", "0.0000001", "1e3", "-1", "1,000"]) {
    assert.throws(() => parseUsdcToBaseUnits(value));
  }
  assert.equal(unixSeconds(new Date("2026-10-06T00:00:00.000Z")), 1791244800);
});

test("Panta policy rejects unknown programs, extra signers and missing market or mint", () => {
  const instructions = [{ programId: "reviewed", data: "", accounts: [{ pubkey: "wallet", isSigner: true }, { pubkey: "market" }, { pubkey: "mint" }] }];
  assert.doesNotThrow(() => assertInstructionPolicy("wallet", "market", "mint", ["reviewed"], instructions));
  assert.throws(() => assertInstructionPolicy("wallet", "market", "mint", ["other"], instructions), /unreviewed/);
  assert.throws(() => assertInstructionPolicy("other-wallet", "market", "mint", ["reviewed"], instructions), /signer/);
  assert.throws(() => assertInstructionPolicy("wallet", "other-market", "mint", ["reviewed"], instructions), /market/);
  assert.throws(() => assertInstructionPolicy("wallet", "market", "other-mint", ["reviewed"], instructions), /mint/);
});
