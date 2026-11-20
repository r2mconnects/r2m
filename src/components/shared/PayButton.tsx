"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PayButton({ kind, orderId, label }: { kind: "membership_fee" | "renewal" | "shop_order"; orderId?: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function pay() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, orderId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start payment.");
      if (!(await loadScript()) || !window.Razorpay) throw new Error("Could not load the payment gateway. Check your connection.");
      const rz = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: "R2M CONNECT",
        description: data.description,
        prefill: data.prefill,
        theme: { color: "#123B78" },
        handler: async (r: Record<string, string>) => {
          const v = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
          const vd = await v.json();
          if (v.ok) {
            setMsg({ type: "ok", text: "Payment verified. Thank you!" });
            router.refresh();
          } else setMsg({ type: "err", text: vd.error ?? "Verification failed." });
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={pay} disabled={busy} className="btn btn-accent w-full sm:w-auto">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />} {label}
      </button>
      {msg && <p className={`mt-2 text-sm ${msg.type === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
