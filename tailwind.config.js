/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Fira Code", "monospace"],
      },
      colors: {
        bg:             "var(--color-bg)",
        panel:          "var(--color-panel)",
        "panel-alt":    "var(--color-panel-alt)",
        "panel-hover":  "var(--color-panel-hover)",
        border:         "var(--color-border)",
        "border-soft":  "var(--color-border-soft)",
        "border-focus": "var(--color-border-focus)",
        accent:         "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        text: {
          primary:   "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted:     "var(--color-text-muted)",
          inverse:   "var(--color-text-inverse)",
        },
        status: {
          ok:     "var(--color-status-ok)",
          warn:   "var(--color-status-warn)",
          danger: "var(--color-status-danger)",
          info:   "var(--color-status-info)",
        },
        severity: {
          high:   "var(--color-severity-high)",
          medium: "var(--color-severity-medium)",
          low:    "var(--color-severity-low)",
          info:   "var(--color-severity-info)",
        },
        alert: {
          open:         "var(--color-alert-open)",
          acknowledged: "var(--color-alert-acknowledged)",
          escalated:    "var(--color-alert-escalated)",
          resolved:     "var(--color-alert-resolved)",
        },
        compliance: {
          good: "var(--color-compliance-good)",
          warn: "var(--color-compliance-warn)",
          bad:  "var(--color-compliance-bad)",
        },
        chart: {
          1: "var(--color-chart-1)",
          2: "var(--color-chart-2)",
          3: "var(--color-chart-3)",
          4: "var(--color-chart-4)",
          5: "var(--color-chart-5)",
          6: "var(--color-chart-6)",
        },
      },
    },
  },
  plugins: [],
};
