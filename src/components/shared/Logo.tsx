export function LogoMark({ size = 36 }: { size?: number }) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="R2M CONNECT logo">
      <g fill="#0756B5">
        <circle cx="32" cy="32" r="23" />
        {teeth.map((a) => (
          <rect key={a} x="27" y="2" width="10" height="12" rx="2" transform={`rotate(${a} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="17" fill="#fff" />
      <path d="M17 26 Q32 10 49 22" stroke="#F59E0B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <text x="32" y="38" textAnchor="middle" fontWeight="900" fontSize="14" fontFamily="Inter, Arial, sans-serif" fill="#123B78">
        R<tspan fill="#F59E0B">2</tspan>M
      </text>
      <rect x="6" y="46" width="52" height="9" rx="4.5" fill="#123B78" />
      <text x="32" y="53.2" textAnchor="middle" fontWeight="800" fontSize="6.5" fontFamily="Inter, Arial, sans-serif" fill="#fff" letterSpacing="0.4">
        CONNECT
      </text>
    </svg>
  );
}

export function Logo({ light = false, small = false, size = 36 }: { light?: boolean; small?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className={`block text-base font-extrabold tracking-tight ${light ? "text-white" : "text-navy"}`}>
          R<span className="text-accent">2</span>M CONNECT
        </span>
        {!small && (
          <span className={`block text-[10px] font-medium ${light ? "text-blue-100" : "text-slate-500"}`}>
            Rayalaseema Two-Wheeler Mechanics Welfare Seva
          </span>
        )}
      </span>
    </span>
  );
}
