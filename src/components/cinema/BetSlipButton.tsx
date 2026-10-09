"use client";
import { Layers3 } from "lucide-react";
export function BetSlipButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return <button className="cinema-betslip" onClick={onClick} aria-label={selected ? "Review selected market" : "Open prediction markets"}>{selected ? <strong>01</strong> : <Layers3 size={20}/>}<span>{selected ? "Selected" : "Markets"}</span></button>;
}
