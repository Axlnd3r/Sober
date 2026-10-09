import type { NextConfig } from "next";
const nextConfig: NextConfig = { reactStrictMode: true, devIndicators: false, ...(process.env.SOBER_TEST_SERVER === "true" ? { distDir: ".next-tests" } : process.env.SOBER_DEMO_SERVER === "true" ? { distDir: ".next-demo" } : {}) };
export default nextConfig;
