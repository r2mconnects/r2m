"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({ name = "password", label = "Password", autoComplete = "current-password" }: { name?: string; label?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={`f-${name}`}>
        {label} *
      </label>
      <div className="relative">
        <input id={`f-${name}`} name={name} type={show ? "text" : "password"} required minLength={8} autoComplete={autoComplete} className="input pr-10" />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
