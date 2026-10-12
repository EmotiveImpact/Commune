import net from "node:net";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
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

/**
 * vercel.json allows connections to any HTTPS host, so a preview built for a
 * new Neon branch cannot break on its host name. A build that knows its Neon
 * endpoints narrows that to exactly those origins; browsers enforce both.
 */
export function exactConnectPolicy(env: Record<string, string | undefined>): Plugin {
  return {
    name: "exact-connect-policy",
    apply: "build",
    transformIndexHtml(html) {
      const origins = [env.VITE_NEON_AUTH_URL, env.VITE_NEON_DATA_API_URL, env.VITE_REMINDER_FUNCTION_URL]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .map((value) => new URL(value).origin);
      if (!origins.length) return html;
      const charset = '<meta charset="UTF-8" />';
      if (!html.includes(charset)) throw new Error("index.html must declare its charset before the connect policy");
      return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="connect-src 'self' ${[...new Set(origins)].join(" ")}" />`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    listenIpv6Too(),
    exactConnectPolicy(loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_")),
  ],
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
}));
