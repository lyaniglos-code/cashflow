// Line-style nav icons that inherit color via currentColor and share one stroke
// language (1.75px, round caps) so the sidebar feels custom and cohesive.
function Svg({ children, size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Dashboard — overview panels with a pulse line in the hero panel.
export function DashboardIcon(p) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="11" height="8" rx="1.6" />
      <path d="M5 7.2 l1.6 0 l1-1.8 l1.3 3 l1-1.2 l1.3 0" />
      <rect x="16" y="3" width="5" height="5" rx="1.6" />
      <rect x="3" y="13" width="6.5" height="8" rx="1.6" />
      <rect x="11.5" y="10.5" width="9.5" height="10.5" rx="1.6" />
    </Svg>
  );
}

// Analytics — trend line climbing across an axis.
export function AnalyticsIcon(p) {
  return (
    <Svg {...p}>
      <path d="M4 4 V20 H20" />
      <path d="M7.5 14.5 L11 10.5 L13.5 12.5 L19 6.5" />
      <circle cx="19" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Weekly Digest — a folded report with text lines.
export function DigestIcon(p) {
  return (
    <Svg {...p}>
      <path d="M6 3 h9 l4 4 v14 a1 1 0 0 1 -1 1 H6 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 Z" />
      <path d="M15 3 v4 h4" />
      <path d="M8.5 12 H15.5 M8.5 15.5 H15.5 M8.5 19 H13" />
    </Svg>
  );
}

// Scenario Planner — what-if sliders.
export function ScenarioIcon(p) {
  return (
    <Svg {...p}>
      <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
      <circle cx="9" cy="7" r="2.1" fill="var(--icon-knob, #15171d)" />
      <circle cx="15" cy="12" r="2.1" fill="var(--icon-knob, #15171d)" />
      <circle cx="8" cy="17" r="2.1" fill="var(--icon-knob, #15171d)" />
    </Svg>
  );
}

// Import Data — arrow dropping into a tray.
export function ImportIcon(p) {
  return (
    <Svg {...p}>
      <path d="M12 3 V13.5" />
      <path d="M8 9.5 L12 13.5 L16 9.5" />
      <path d="M4 15 v3.5 a1.5 1.5 0 0 0 1.5 1.5 H18.5 a1.5 1.5 0 0 0 1.5 -1.5 V15" />
    </Svg>
  );
}

// Settings — a clean cog.
export function SettingsIcon(p) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5 v2.4 M12 19.1 v2.4 M2.5 12 h2.4 M19.1 12 h2.4 M5.1 5.1 l1.7 1.7 M17.2 17.2 l1.7 1.7 M18.9 5.1 l-1.7 1.7 M6.8 17.2 l-1.7 1.7" />
    </Svg>
  );
}
