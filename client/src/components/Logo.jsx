// Minimalist financial-heartbeat mark: a clean horizontal pulse line with a
// single sharp spike on each side flanking a bold dollar sign. Single teal
// stroke (currentColor). Wide aspect (~120x56); `size` sets the height.
const RATIO = 120 / 56;

export function LogoMark({ size = 26, className = '' }) {
  return (
    <svg
      height={size}
      width={size * RATIO}
      viewBox="0 0 120 56"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* pulse line — left lead + spike, then right spike + lead (thin) */}
      <path
        d="M2 28 H20 L26 11 L31 45 L36 28 H43"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M77 28 H84 L90 11 L95 45 L100 28 H118"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dollar sign — bold S + vertical bar, centered */}
      <path
        d="M68 18 C68 13 60 12 55 15 C50 18 52 24 60 26 C68 28 70 33 65 37 C60 40 52 40 51 35"
        stroke="currentColor"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M60 7 V49" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  );
}

// Logo lockup: the teal mark + optional wordmark.
export default function Logo({ size = 'md', showWord = true }) {
  const h = size === 'lg' ? 30 : size === 'sm' ? 20 : 24;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-teal">
        <LogoMark size={h} />
      </span>
      {showWord && (
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-white">CashFlow</div>
          <div className="text-[11px] font-medium text-slate-400">Financial pulse</div>
        </div>
      )}
    </div>
  );
}
