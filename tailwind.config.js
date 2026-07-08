/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      colors: {
        bg: "#12151A",
        panel: "#1B1F27",
        "panel-alt": "#20242D",
        border: "#262B34",
        "border-soft": "#21252D",
        text: {
          primary: "#FFFFFF",
          secondary: "#FFFFFF",
          muted: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#4A8FA3",
          dim: "#3A7387",
        },
        status: {
          ok: "#4F9E7C",
          warn: "#D9A441",
          danger: "#C25450",
        },
      },
    },
  },
  plugins: [],
};
