export const SESSION_TTL_MS      = 8 * 60 * 60 * 1000;  // 8 hours
export const EXPIRY_CHECK_MS     = 60 * 1_000;           // 60 seconds
export const WS_RECONNECT_MAX_MS = 30 * 1_000;           // 30 seconds
export const WS_EVENT_INTERVAL_MIN_MS = 2_000;
export const WS_EVENT_INTERVAL_MAX_MS = 4_000;
export const WS_MOCK_DISCONNECT_INTERVAL_MS = 90_000;

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
