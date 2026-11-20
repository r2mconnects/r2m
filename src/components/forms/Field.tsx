import type { ReactNode } from "react";

type Opt = { value: string; label: string };

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  options,
  rows,
  hint,
  className,
  accept,
  min,
  step,
  autoComplete,
  multiple,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  options?: Opt[];
  rows?: number;
  hint?: ReactNode;
  className?: string;
  accept?: string;
  min?: number | string;
  step?: number | string;
  autoComplete?: string;
  multiple?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
        {required && " *"}
      </label>
      {options ? (
        <select id={id} name={name} className="input" required={required} defaultValue={defaultValue ?? ""}>
          {!required && <option value="">—</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : rows ? (
        <textarea id={id} name={name} rows={rows} className="input" required={required} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          className="input"
          required={required}
          defaultValue={defaultValue ?? undefined}
          placeholder={placeholder}
          accept={accept}
          min={min}
          step={step}
          autoComplete={autoComplete}
          multiple={multiple}
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Checkbox({ label, name, defaultChecked }: { label: ReactNode; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}
