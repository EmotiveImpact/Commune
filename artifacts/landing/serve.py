#!/usr/bin/env python3
"""Serve landing studies and versioned explorations as real HTML."""

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
VERSIONS = SITE / "versions"
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
    "/versions/tokens.css": VERSIONS / "tokens.css",
}


def _safe(root: Path, rel: str) -> Path | None:
    candidate = (root / rel).resolve()
    base = root.resolve()
    if candidate.is_file() and str(candidate).startswith(str(base) + os.sep):
        return candidate
    return None


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[landing] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:
        self._serve(write_body=True)

    def do_HEAD(self) -> None:
        self._serve(write_body=False)

    def _serve(self, write_body: bool) -> None:
        path = unquote(urlparse(self.path).path)
        target = PAGES.get(path)

        if target is None and path.startswith("/v/"):
            rest = path[3:]
            # /v/split → /v/split/ so relative assets resolve
            if rest and not rest.endswith("/") and "/" not in rest:
                self.send_response(301)
                self.send_header("Location", path + "/")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                return
            rest = rest.strip("/")
            if rest:
                if "/" not in rest:
                    target = VERSIONS / rest / "index.html"
                else:
                    target = _safe(VERSIONS, rest)

        if target is None and path.startswith("/versions/"):
            target = _safe(SITE, path.lstrip("/"))

        if target is None:
            target = _safe(PUBLIC, path.lstrip("/"))

        if target is None or not Path(target).is_file():
            self.send_error(404, "Not found")
            return

        target = Path(target)
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
        if write_body:
            self.wfile.write(data)


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Landing studies on http://127.0.0.1:{PORT}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
