import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // When running `vercel dev` this isn't needed (it serves /api itself).
      // This proxy only helps if you ever run plain `vite` + a separate local
      // function runner on port 3001. Most people should just use `vercel dev`.
    },
  },
});
