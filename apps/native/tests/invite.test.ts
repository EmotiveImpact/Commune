// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inviteToken, shareLink } from "../src/lib/inviteLink";
import { qrMatrix, qrPath } from "../src/lib/qr";

describe("invitation links", () => {
  it("turns any server link into the join address", () => {
    expect(shareLink("https://app.ourcommune.io/invite?token=demo3")).toBe("https://app.ourcommune.io/join/demo3");
    expect(shareLink("http://localhost:3000/join/abc_DEF-12")).toBe("https://app.ourcommune.io/join/abc_DEF-12");
    expect(inviteToken("commune://join/xyz")).toBe("xyz");
  });

  it("keeps a link with no token as it is", () => {
    expect(shareLink("https://example.com/other")).toBe("https://example.com/other");
  });
});

describe("QR code", () => {
  it("is a square of a sensible size for a typical invitation link", () => {
    const matrix = qrMatrix("https://app.ourcommune.io/join/Q2xhaW1lZC1pbnZpdGUtdG9rZW4tMTIzNDU2");
    const size = matrix.length;
    expect(matrix.every((row) => row.length === size)).toBe(true);
    // Version 3 to 6 (29 to 41 modules) at medium correction for a link this long.
    expect(size).toBeGreaterThanOrEqual(29);
    expect(size).toBeLessThanOrEqual(41);
    // Finder pattern: the top-left corner is dark and its 7x7 ring is complete.
    expect(matrix[0].slice(0, 7).every(Boolean)).toBe(true);
    expect(qrPath(matrix).startsWith("M0 0h1v1h-1z")).toBe(true);
  });
});
