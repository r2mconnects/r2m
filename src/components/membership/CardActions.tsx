"use client";
import { useState } from "react";
import { Download, Printer, Share2 } from "lucide-react";

export function CardActions({ link, fileName }: { link: string; fileName: string }) {
  const [msg, setMsg] = useState("");

  async function downloadPdf() {
    const node = document.getElementById("member-card");
    if (!node) return;
    setMsg("Preparing PDF…");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const png = await toPng(node, { pixelRatio: 3, cacheBust: true, skipFonts: true, backgroundColor: "#ffffff" });
      const w = 86;
      const h = (node.offsetHeight / node.offsetWidth) * w;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [w, h] });
      pdf.addImage(png, "PNG", 0, 0, w, h);
      pdf.save(`${fileName}.pdf`);
      setMsg("");
    } catch {
      setMsg("Could not generate the PDF. Use Print and choose “Save as PDF”.");
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "R2M CONNECT membership", url: link });
      else {
        await navigator.clipboard.writeText(link);
        setMsg("Verification link copied.");
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="no-print mx-auto mt-4 grid max-w-[360px] gap-2">
      <button onClick={downloadPdf} className="btn btn-primary w-full"><Download size={18} /> Download PDF</button>
      <button onClick={() => window.print()} className="btn btn-outline w-full"><Printer size={18} /> Print ID Card</button>
      <button onClick={share} className="btn btn-outline w-full"><Share2 size={18} /> Share verification link</button>
      {msg && <p className="text-center text-xs text-slate-600" role="status">{msg}</p>}
    </div>
  );
}
