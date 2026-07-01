/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base is "/" for local dev + backend-served prod; the GitHub Pages workflow
// sets VITE_BASE=/pianocoach/ so asset URLs resolve under the repo subpath.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // ws:true so the MIDI WebSocket (/api/midi/stream) also proxies in dev.
      "/api": { target: "http://localhost:8000", ws: true },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
