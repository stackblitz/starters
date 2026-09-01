/* Minimal inline icons for the dock (no icon-font dependency). */
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconGrid = () => (
  <svg {...base}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconSidebar = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 4v16" />
  </svg>
);
export const IconLeft = () => (
  <svg {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconRight = () => (
  <svg {...base}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconPencil = () => (
  <svg {...base}>
    <path d="M4 20h4l10-10a2 2 0 0 0-3-3L5 17z" />
  </svg>
);
export const IconExpand = () => (
  <svg {...base}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
export const IconShrink = () => (
  <svg {...base}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </svg>
);
export const IconPresent = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);
export const IconClose = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconGrip = () => (
  <svg {...base} stroke="none" fill="currentColor">
    <circle cx="9" cy="6.5" r="1.15" />
    <circle cx="15" cy="6.5" r="1.15" />
    <circle cx="9" cy="12" r="1.15" />
    <circle cx="15" cy="12" r="1.15" />
    <circle cx="9" cy="17.5" r="1.15" />
    <circle cx="15" cy="17.5" r="1.15" />
  </svg>
);
export const IconExport = () => (
  <svg {...base}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
  </svg>
);
export const IconNotes = () => (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 9.5h8M8 13h8M8 16.5h4.5" />
  </svg>
);
export const IconTrash = () => (
  <svg {...base}>
    <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" />
  </svg>
);
export const IconPlay = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <path d="M8 5.14v13.72c0 .9 1 1.45 1.77.97l10.4-6.86a1.15 1.15 0 0 0 0-1.94L9.77 4.17C9 3.69 8 4.24 8 5.14Z" />
  </svg>
);
