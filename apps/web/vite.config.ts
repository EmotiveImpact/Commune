import net from "node:net";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PORT = 3000;

/** Chrome uses ::1 for localhost. Cursor’s detector looks for 0.0.0.0. Bind both. */
function listenIpv6Too(): Plugin {
  return {
    name: "listen-ipv6-too",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        // Exact phrase Cursor’s hybrid port-forward scanner matches (see serve.py on :3001).
        console.log(`listening on 0.0.0.0:${PORT}`);
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
        proxy.listen({ port: PORT, host: "::", ipv6Only: true });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), listenIpv6Too()],
  server: {
    host: "0.0.0.0",
    port: PORT,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: PORT,
    strictPort: true,
    allowedHosts: true,
  },
});
