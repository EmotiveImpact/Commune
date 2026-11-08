import { describe, expect, it } from "vitest";
import { demoBackend } from "../src/lib/demo";
import { appLink, billMessage, groupLink, nudgeMessage, shareUrl, taskMessage, tidyGroupLink } from "../src/lib/whatsapp";

describe("WhatsApp on the phone", () => {
  it("tidies a pasted group link and refuses anything else", () => {
    expect(tidyGroupLink(" https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?mode=ems_copy_t ")).toBe("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv");
    expect(tidyGroupLink("")).toBe("");
    expect(tidyGroupLink("https://wa.me/447700900123")).toBeNull();
    expect(tidyGroupLink("https://chat.whatsapp.com.evil.test/AbCdEfGhIjKlMnOpQrStUv")).toBeNull();
    expect(groupLink("javascript:alert(1)")).toBe("");
  });

  it("writes the same messages as the web app, linking to the web app", () => {
    expect(shareUrl("a & b")).toBe("https://wa.me/?text=a%20%26%20b");
    expect(appLink("/expenses/e1", { commune: "c1" })).toBe("https://app.ourcommune.io/expenses/e1?commune=c1");
    expect(billMessage({ title: "Electric", amount: "£84.00", payerName: "Ama Owusu", communeName: "Flat 4", due: "14 Nov", shareAmount: "£21.00", link: "L" }))
      .toBe("🧾 Electric in Flat 4: £84.00, paid by Ama.\nEach share is £21.00. Due 14 Nov.\nSee your share and settle up in Commune: L");
    expect(taskMessage({ title: "Bins out", communeName: "Flat 4", when: "today", holderName: "Theo Park", link: "L" }))
      .toBe("🧹 Bins out in Flat 4: Theo’s turn, due today.\nTick it off in Commune when it’s done: L");
    expect(nudgeMessage({ name: "Mei Chen", amount: "£21.00", subject: "Electric", link: "L" }))
      .toBe("👋 Hi Mei, a gentle reminder about £21.00 for Electric.\nIt’s all in Commune: L");
  });

  it("lets the demo admin link and remove a group chat", async () => {
    const backend = demoBackend(() => "2026-11-08");
    const [park, studio] = await backend.communes();
    expect(park.chatLink).toMatch(/^https:\/\/chat\.whatsapp\.com\//);
    expect(studio.chatLink).toBeUndefined();
    await expect(backend.setChatLink(studio.id, "https://example.com/nope")).rejects.toMatchObject({ status: 400 });
    expect(await backend.setChatLink(studio.id, "chat.whatsapp.com/StudioEastGroupLink22")).toBe("https://chat.whatsapp.com/StudioEastGroupLink22");
    expect((await backend.snapshot(studio)).commune.chatLink).toBe("https://chat.whatsapp.com/StudioEastGroupLink22");
    expect(await backend.setChatLink(studio.id, "")).toBe("");
  });
});
