"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Navbar } from "@/components/cinema/Navbar";

export { useSoberSession, WalletControl } from "./WalletControl";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/") return <>{children}</>;

  return <div className="site-interior">
    <a className="skip-content" href="#main-content">Skip to content</a>
    <Navbar onSearch={() => router.push("/matches?focus=search#match-center")} onMarkets={() => router.push("/markets")} />
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="interior-footer"><span>© {new Date().getFullYear()} Sober. Football, in focus.</span><div><Link href="/privacy">Privacy</Link><a href="https://www.panta.market/" target="_blank" rel="noreferrer">Powered by Panta <ArrowUpRight size={13}/></a></div></footer>
  </div>;
}
