export default function StatCard({ label, value, sub, tone = 'default', icon }) {
  const toneClasses = {
    default: 'text-white',
    positive: 'text-teal',
    negative: 'text-red-400',
    accent: 'text-teal',
    muted: 'text-slate-300',
  };
  return (
    <div className="card card-hover p-4 lg:p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        {icon && <span className="text-sm opacity-60">{icon}</span>}
      </div>
      <div
        className={`tnum mt-2 text-2xl font-bold tracking-tight lg:text-[1.7rem] ${toneClasses[tone] || toneClasses.default}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
