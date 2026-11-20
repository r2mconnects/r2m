"use client";
import { useState } from "react";

export function SosLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState("");
  return (
    <div className="text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="shareLocation"
          className="mt-0.5 h-4 w-4"
          onChange={(e) => {
            if (!e.target.checked) return setCoords(null);
            if (!navigator.geolocation) return setErr("Location is not available on this device.");
            navigator.geolocation.getCurrentPosition(
              (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setErr(""); },
              () => { setErr("Location permission denied."); e.target.checked = false; },
            );
          }}
        />
        <span>Share my current location with association coordinators (optional, with my consent)</span>
      </label>
      {coords && (<><input type="hidden" name="lat" value={coords.lat} /><input type="hidden" name="lng" value={coords.lng} /><p className="text-xs text-green-700">Location captured.</p></>)}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
