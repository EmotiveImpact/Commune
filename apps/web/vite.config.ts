import net from "node:net";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PORT = 3000;
// Loopback only. Browser QA can point this one UI at an isolated test API
// (COMMUNE_API_PORT=3005) instead of starting a second UI server.
const API_PORT = Number(process.env.COMMUNE_API_PORT ?? 3002);
if (!Number.isInteger(API_PORT) || API_PORT < 1024 || API_PORT > 65535) {
  throw new Error("COMMUNE_API_PORT must be a local port between 1024 and 65535");
}

/** Chrome can resolve localhost to ::1. Keep both listeners loopback-only. */
function listenIpv6Too(): Plugin {
  return {
    name: "listen-ipv6-too",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const proxy = net.createServer((client) => {
          const dest = net.connect({ port: PORT, host: "127.0.0.1" });
          dest.on("error", () => client.destroy());
          client.on("error", () => dest.destroy());
          client.pipe(dest);
          dest.pipe(client);
        });
        proxy.on("error", (err) => {
          console.warn("[ipv6]", err.message);
        });
        proxy.listen({ port: PORT, host: "::1", ipv6Only: true });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), listenIpv6Too()],
  server: {
    host: "127.0.0.1",
    port: PORT,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: PORT,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"],
  },
});
