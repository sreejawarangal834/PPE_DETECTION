// SESSION_TTL_MS and the WS_MOCK_*/WS_EVENT_INTERVAL_* constants that used to live here were
// only ever consumed by the mock auth token / mockWebSocketService.ts, both removed (real
// JWT expiry and the real /ws/alerts socket replaced them respectively) — removed rather
// than left as unused dead constants.
export const EXPIRY_CHECK_MS     = 60 * 1_000;           // 60 seconds

export const PAGE_SIZE_DEFAULT  = 25;
export const PAGE_SIZE_AUDIT    = 50;
export const TOP_ZONES_COUNT    = 5;
export const NOTIFICATION_MAX   = 99;

export const VIEW_MODE_DEFAULT    = 'single';             // default for Safety Officer landing
export const VIEW_MODE_STORAGE_KEY = 'monitoring_view_mode';

export const APP_NAME = 'PPE Monitoring';
export const SITE_NAME = 'Innovision Industrial Site';

export const COMPLIANCE_THRESHOLDS = {
  GREEN: 80,
  AMBER: 60,
} as const;
