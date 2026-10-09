export function parseUsdcToBaseUnits(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) throw new Error("Use a positive decimal USDC amount with at most six decimal places");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (amount <= 0n) throw new Error("Amount must be greater than zero");
  return amount;
}
export function formatUsdcBaseUnits(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 1_000_000n}.${String(absolute % 1_000_000n).padStart(6, "0")}`;
}
export function unixSeconds(date: Date): number {
  const seconds = Math.floor(date.getTime() / 1000);
  if (!Number.isSafeInteger(seconds)) throw new Error("Invalid time");
  return seconds;
}
