import { defineConfig } from "vite";

export default defineConfig({
  base: "/cusum-browser-app/",
  build: {
    // Keep user-facing synthetic downloads as inspectable static files.
    assetsInlineLimit: 0,
  },
});
