import net from "node:net";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PORT = 3000;

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
        target: "http://127.0.0.1:3002",
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
