"use client";
import { Printer } from "lucide-react";

export function PrintButton({ text = "Print / Save as PDF" }: { text?: string }) {
  return (
    <button onClick={() => window.print()} className="btn btn-primary no-print">
      <Printer size={16} /> {text}
    </button>
  );
}
