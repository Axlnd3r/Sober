import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./integration.css";
import "./cinema.css";
import "./interior.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
export const metadata: Metadata = { title: "Sober | Make the call before kickoff", description: "Football match context, locked fan forecasts, and Panta prediction markets in one match room." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers><Shell>{children}</Shell></Providers></body></html>; }
