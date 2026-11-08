// @vitest-environment node
import { describe, expect, it } from "vitest";
import { demoBackend } from "../src/lib/demo";
import { shareLink } from "../src/lib/inviteLink";

describe("inviting one person from contacts (demo)", () => {
  it("makes a link for them and lists them as waiting", async () => {
    const backend = demoBackend();
    await backend.signIn("maya@example.com", "x");
    const [commune] = await backend.communes();
    const { url } = await backend.invitePerson(commune.id, "  Theo   Lambert ", "whatsapp");
    expect(shareLink(url)).toMatch(/^https:\/\/app\.ourcommune\.io\/join\/demo/);
    const waiting = await backend.waitingInvites(commune.id);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ name: "Theo Lambert", email: false, sentVia: "whatsapp" });
  });

  it("needs a name", async () => {
    const backend = demoBackend();
    await backend.signIn("maya@example.com", "x");
    const [commune] = await backend.communes();
    await expect(backend.invitePerson(commune.id, "   ", "text")).rejects.toThrow(/name/);
  });
});
