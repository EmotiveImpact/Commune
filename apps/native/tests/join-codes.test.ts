// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEMO_ELM_STICKER, demoBackend } from "../src/lib/demo";
import { askedWords, expiryWords, isLive, joinCodeUrl, tokenFromJoinLink, type JoinCode } from "../src/lib/joinCodes";

// A made-up code, kept plain so the secret scan does not read it as a key.
const TOKEN = "ab".repeat(16);

describe("join code links", () => {
  it("makes the short link a QR carries", () => {
    expect(joinCodeUrl(TOKEN)).toBe(`https://app.ourcommune.io/j/${TOKEN}`);
  });
  it("reads the code from every link that carries one", () => {
    expect(tokenFromJoinLink(`https://app.ourcommune.io/j/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromJoinLink(`commune://join-code/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromJoinLink(`https://app.ourcommune.io/join?code=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromJoinLink(`https://app.ourcommune.io/j/${TOKEN}?utm=x`)).toBe(TOKEN);
  });
  it("ignores links that are not join codes", () => {
    expect(tokenFromJoinLink("https://app.ourcommune.io/join/abc")).toBeNull();
    expect(tokenFromJoinLink(`https://app.ourcommune.io/j/${TOKEN}0`)).toBeNull();
    expect(tokenFromJoinLink("hello")).toBeNull();
  });
});

describe("join code wording", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const code = (expiresAt: string | null): JoinCode => ({ id: "c", kind: expiresAt ? "now" : "sticker", token: TOKEN, createdAt: now.toISOString(), expiresAt });
  it("says when a code shown now stops working, and nothing for a sticker", () => {
    expect(expiryWords(code("2026-11-07T13:00:00Z"), now)).toBe("Stops working in an hour");
    expect(expiryWords(code("2026-11-07T12:25:00Z"), now)).toBe("Stops working in 25 minutes");
    expect(expiryWords(code("2026-11-07T12:01:00Z"), now)).toBe("Stops working in 1 minute");
    expect(expiryWords(code("2026-11-07T11:59:00Z"), now)).toBe("This code has stopped working");
    expect(expiryWords(code(null), now)).toBeNull();
  });
  it("knows which codes still work", () => {
    expect(isLive(code(null), now)).toBe(true);
    expect(isLive(code("2026-11-07T12:30:00Z"), now)).toBe(true);
    expect(isLive(code("2026-11-07T11:30:00Z"), now)).toBe(false);
  });
  it("says how long ago someone asked", () => {
    expect(askedWords("2026-11-07T11:20:00Z", now)).toBe("40 minutes ago");
    expect(askedWords("2026-11-07T11:59:40Z", now)).toBe("just now");
    expect(askedWords("2026-11-07T09:00:00Z", now)).toBe("3 hours ago");
  });
});

describe("joining by QR code (demo)", () => {
  it("has Priya waiting to join Park Street, and approving makes her a member", async () => {
    const backend = demoBackend();
    const park = (await backend.communes()).find((commune) => commune.name === "14 Park Street")!;
    const state = await backend.joinState(park.id);
    expect(state.joinMode).toBe("approve");
    expect(state.requests.map((request) => request.name)).toEqual(["Priya Shah"]);
    const after = await backend.decideJoinRequest(state.requests[0].id, "approve");
    expect(after.requests).toHaveLength(0);
    const snapshot = await backend.snapshot(park);
    expect(snapshot.members.find((member) => member.name === "Priya Shah")?.role).toBe("member");
  });

  it("previews the Elm Road sticker and asks to join", async () => {
    const backend = demoBackend();
    const preview = await backend.previewJoinCode(DEMO_ELM_STICKER);
    expect(preview).toMatchObject({ communeName: "22 Elm Road", alreadyMember: false, waiting: false });
    expect((await backend.requestToJoin(DEMO_ELM_STICKER, "r1")).status).toBe("pending");
    expect((await backend.previewJoinCode(DEMO_ELM_STICKER))?.waiting).toBe(true);
  });

  it("makes codes, refuses them when off, and a new sticker replaces the old", async () => {
    const backend = demoBackend();
    const park = (await backend.communes()).find((commune) => commune.name === "14 Park Street")!;
    const first = await backend.createJoinCode(park.id, "sticker", "a");
    const second = await backend.createJoinCode(park.id, "sticker", "b");
    expect(await backend.previewJoinCode(first.token)).toBeNull();
    expect((await backend.previewJoinCode(second.token))?.alreadyMember).toBe(true);
    const now = await backend.createJoinCode(park.id, "now", "c");
    expect(now.expiresAt).not.toBeNull();
    await backend.setJoinMode(park.id, "off");
    expect(await backend.previewJoinCode(second.token)).toBeNull();
    await expect(backend.createJoinCode(park.id, "now", "d")).rejects.toThrow();
  });
});
