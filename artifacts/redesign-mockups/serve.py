#!/usr/bin/env python3
"""Serve these mockups on http://localhost:3000/ (IPv4 and IPv6)."""
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 3000


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True
    daemon_threads = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)


if __name__ == "__main__":
    os.chdir(ROOT)
    DualStackServer(("::", PORT), Handler).serve_forever()
