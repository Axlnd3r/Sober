export const mode = process.env.APP_MODE === "live" ? "live" : "simulation";
export const appUrl = process.env.APP_URL || "http://localhost:3000";
export const network = process.env.SOLANA_NETWORK || "unverified";
export const rpcUrl = process.env.SOLANA_RPC_URL || "";
const transactionNetworkReady = Boolean(rpcUrl && process.env.NEXT_PUBLIC_SOLANA_RPC_URL && network !== "unverified" && process.env.PANTA_EXPECTED_GENESIS_HASH && process.env.PANTA_USDC_MINT && process.env.PANTA_PROGRAM_IDS);
export const tradingEnabled = mode === "live" && transactionNetworkReady && process.env.TRADING_ENABLED === "true";
export const claimsEnabled = mode === "live" && transactionNetworkReady && process.env.CLAIMS_ENABLED === "true";
export const createEnabled = mode === "live" && transactionNetworkReady && process.env.CREATE_ENABLED === "true";
export const isAdmin = (wallet: string) => (process.env.ADMIN_WALLET_ALLOWLIST || "").split(",").map(x => x.trim()).includes(wallet);
