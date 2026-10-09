"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleDot, Globe2, Search, ChevronDown, Menu, X } from "lucide-react";
import { WalletControl, useSoberSession } from "@/components/WalletControl";

export function Navbar({ onSearch, onMarkets }: { onSearch: () => void; onMarkets: () => void }) {
  const pathname = usePathname();
  const { session } = useSoberSession();
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState<"UTC" | "local">("UTC");
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => { setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(false); document.querySelector<HTMLButtonElement>(".cinema-menu-toggle")?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  return <header className="cinema-nav">
    <Link href="/" className="cinema-wordmark" aria-label="Sober home">sober<span>.</span></Link>
    <nav className={`cinema-main-nav ${menu ? "is-open" : ""}`} id="cinema-main-nav" aria-label="Main navigation">
      <Link href="/" className={pathname === "/" ? "is-active" : ""} aria-current={pathname === "/" ? "page" : undefined} onClick={() => setMenu(false)}>Overview</Link>
      <Link href="/matches" className={pathname.startsWith("/matches") ? "is-active" : ""} aria-current={pathname.startsWith("/matches") ? "page" : undefined} onClick={() => setMenu(false)}>Match center</Link>
      {pathname === "/" ? <button onClick={() => { setMenu(false); onMarkets(); }}>Panta markets</button> : <Link href="/markets" className={pathname === "/markets" ? "is-active" : ""} aria-current={pathname === "/markets" ? "page" : undefined} onClick={() => setMenu(false)}>Panta markets</Link>}
      <Link href="/saved" className={pathname === "/saved" ? "is-active" : ""} aria-current={pathname === "/saved" ? "page" : undefined} onClick={() => setMenu(false)}>Saved matches</Link>
      <Link href="/notebook" className={pathname === "/notebook" ? "is-active" : ""} aria-current={pathname === "/notebook" ? "page" : undefined} onClick={() => setMenu(false)}>My notebook</Link>
      <Link href="/positions" className={pathname === "/positions" ? "is-active" : ""} aria-current={pathname === "/positions" ? "page" : undefined} onClick={() => setMenu(false)}>My positions</Link>
      {session?.admin && <Link href="/admin" className={pathname.startsWith("/admin") ? "is-active" : ""} aria-current={pathname.startsWith("/admin") ? "page" : undefined} onClick={() => setMenu(false)}>Admin</Link>}
    </nav>
    <div className="cinema-sport"><CircleDot size={19} strokeWidth={1.3}/><span>Football</span></div>
    <div className="cinema-nav-actions">
      <button className="cinema-timezone" onClick={() => setZone(zone === "UTC" ? "local" : "UTC")} title="Switch between UTC and your local time" aria-label={`Time zone ${zone}. Switch time zone`}><Globe2 size={13}/><span suppressHydrationWarning>{now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: zone === "UTC" ? "UTC" : undefined }) : "--:--"} <small>({zone === "UTC" ? "UTC" : "LOCAL"})</small></span><ChevronDown size={11}/></button>
      <button className="cinema-icon-button" aria-label={pathname === "/" ? "Search markets" : "Search matches"} onClick={onSearch}><Search size={16}/></button>
      <div className="cinema-wallet"><WalletControl/></div>
      <button className="cinema-icon-button cinema-menu-toggle" aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu} aria-controls="cinema-main-nav" onClick={() => setMenu(!menu)}>{menu ? <X size={20}/> : <Menu size={20}/>}</button>
    </div>
  </header>;
}
