#!/usr/bin/env python3
"""Serve mockups on http://localhost:3000/ for Cursor remote port-forward.

Bind IPv4 0.0.0.0 explicitly so Cursor's port detector can see :3000.
Also bind IPv6 so Chrome's localhost (::1) does not connection-refuse.
"""
import os
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 3000


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        host = self.headers.get("Host", "-")
        print(f"{self.address_string()} Host={host} {fmt % args}", flush=True)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


class IPv6Server(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True
    daemon_threads = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        super().server_bind()


class IPv4Server(ThreadingHTTPServer):
    address_family = socket.AF_INET
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    os.chdir(ROOT)
    v4 = IPv4Server(("0.0.0.0", PORT), Handler)
    v6 = IPv6Server(("::", PORT), Handler)
    threading.Thread(target=v6.serve_forever, daemon=True).start()
    print(f"Serving {ROOT}", flush=True)
    print(f"listening on 0.0.0.0:{PORT}", flush=True)
    print(f"http://127.0.0.1:{PORT}/", flush=True)
    print(f"http://localhost:{PORT}/", flush=True)
    v4.serve_forever()
