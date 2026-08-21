import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Keep user-facing synthetic downloads as inspectable static files.
    assetsInlineLimit: 0,
  },
});
