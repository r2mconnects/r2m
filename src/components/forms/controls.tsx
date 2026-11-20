"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SubmitButton({ children, className = "btn-primary", pending = "Please wait…", confirm }: { children: ReactNode; className?: string; pending?: string; confirm?: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={isPending}
      className={cn("btn", className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {isPending ? (
        <>
          <Loader2 size={16} className="animate-spin" /> {pending}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Dependent district → mandal selects. */
export function GeoSelect({
  districts,
  mandals,
  districtId,
  mandalId,
  required = true,
  optional = false,
}: {
  districts: Array<{ id: string; name: string }>;
  mandals: Array<{ id: string; name: string; districtId: string }>;
  districtId?: string | null;
  mandalId?: string | null;
  required?: boolean;
  optional?: boolean;
}) {
  return <GeoSelectInner {...{ districts, mandals, districtId, mandalId, required, optional }} />;
}

import { useState } from "react";
function GeoSelectInner({ districts, mandals, districtId, mandalId, required, optional }: Parameters<typeof GeoSelect>[0]) {
  const [d, setD] = useState(districtId ?? "");
  return (
    <>
      <div>
        <label className="label" htmlFor="districtId">District{required && " *"}</label>
        <select id="districtId" name="districtId" className="input" required={required} value={d} onChange={(e) => setD(e.target.value)}>
          <option value="">{optional ? "All districts" : "Select district"}</option>
          {districts.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="mandalId">Mandal{required && " *"}</label>
        <select id="mandalId" name="mandalId" className="input" required={required} defaultValue={mandalId ?? ""} key={d}>
          <option value="">{optional ? "All mandals" : "Select mandal"}</option>
          {mandals.filter((m) => m.districtId === d).map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}
