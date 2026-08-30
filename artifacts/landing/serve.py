#!/usr/bin/env python3
"""Serve the landing studies as real HTML so a browser sees the page without Vite."""

from __future__ import annotations

import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

HERE = Path(__file__).resolve().parent
SITE = HERE / "site"
PUBLIC = HERE / "public"
CSS = HERE / "src" / "landing" / "landing.css"
PORT = int(os.environ.get("PORT", "3000"))

PAGES = {
    "/": SITE / "index.html",
    "/index.html": SITE / "index.html",
    "/paper": SITE / "paper.html",
    "/paper/": SITE / "paper.html",
    "/paper.html": SITE / "paper.html",
    "/ink": SITE / "ink.html",
    "/ink/": SITE / "ink.html",
    "/ink.html": SITE / "ink.html",
    "/product": SITE / "product.html",
    "/product/": SITE / "product.html",
    "/product.html": SITE / "product.html",
    "/landing.css": CSS,
}


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[landing] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:
        path = unquote(urlparse(self.path).path)
        target = PAGES.get(path)
        if target is None:
            rel = path.lstrip("/")
            candidate = (PUBLIC / rel).resolve()
            public_root = PUBLIC.resolve()
            if candidate.is_file() and str(candidate).startswith(str(public_root) + os.sep):
                target = candidate
        if target is None or not target.is_file():
            self.send_error(404, "Not found")
            return
        data = target.read_bytes()
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if target.suffix == ".css":
            ctype = "text/css; charset=utf-8"
        elif target.suffix == ".html":
            ctype = "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Landing studies on http://127.0.0.1:{PORT}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
