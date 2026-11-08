// @vitest-environment node
import { describe, expect, it } from "vitest";
import { appLink, billMessage, groupLink, nudgeMessage, shareUrl, taskMessage, tidyGroupLink } from "../src/data/whatsapp";

describe("WhatsApp group links", () => {
  it("tidies what people paste, as the database does", () => {
    expect(tidyGroupLink(" https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?mode=ems_copy_t ")).toBe("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv");
    expect(tidyGroupLink("chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv/")).toBe("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv");
    expect(tidyGroupLink("")).toBe("");
    expect(tidyGroupLink("   ")).toBe("");
  });

  it("refuses anything that is not a group invite link", () => {
    for (const value of ["https://example.com/AbCdEfGhIjKlMnOpQrStUv", "https://chat.whatsapp.com.evil.test/AbCdEfGhIjKlMnOpQrStUv",
      "https://wa.me/447700900123", "https://chat.whatsapp.com/short", "javascript:alert(1)"]) {
      expect(tidyGroupLink(value)).toBeNull();
    }
  });

  it("never opens a stored value that is not a group link", () => {
    expect(groupLink("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv")).toBe("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv");
    expect(groupLink("javascript:alert(1)")).toBe("");
    expect(groupLink(undefined)).toBe("");
  });
});

describe("Share to WhatsApp", () => {
  it("opens WhatsApp with the message encoded", () => {
    expect(shareUrl("Bins & recycling?")).toBe("https://wa.me/?text=Bins%20%26%20recycling%3F");
  });

  it("writes a bill with the payer, the share and a link back", () => {
    expect(billMessage({ title: "Electric", amount: "£84.00", payerName: "Ama Owusu", communeName: "Flat 4",
      due: "14 Nov", shareAmount: "£21.00", link: "https://app.ourcommune.io/expenses/e1?commune=c1" }))
      .toBe("🧾 Electric in Flat 4: £84.00, paid by Ama.\nEach share is £21.00. Due 14 Nov.\nSee your share and settle up in Commune: https://app.ourcommune.io/expenses/e1?commune=c1");
    expect(billMessage({ title: "Pizza", amount: "£30.00", payerName: "Leo", communeName: "Lisbon", link: "L" }))
      .toBe("🧾 Pizza in Lisbon: £30.00, paid by Leo.\nSee your share and settle up in Commune: L");
  });

  it("writes whose turn a task is", () => {
    expect(taskMessage({ title: "Bins out", communeName: "Flat 4", when: "Monday 10 November", holderName: "Theo Park", link: "L" }))
      .toBe("🧹 Bins out in Flat 4: Theo’s turn, due Monday 10 November.\nTick it off in Commune when it’s done: L");
    expect(taskMessage({ title: "Bins out", communeName: "Flat 4", when: "today", yours: true, link: "L" })).toContain("my turn, due today");
    expect(taskMessage({ title: "Bins out", communeName: "Flat 4", when: "today", link: "L" })).toContain("up for grabs");
  });

  it("writes a friendly nudge by first name", () => {
    expect(nudgeMessage({ name: "Mei Chen", amount: "£21.00", subject: "Electric", link: "L" }))
      .toBe("👋 Hi Mei, a gentle reminder about £21.00 for Electric.\nIt’s all in Commune: L");
  });

  it("makes full links from app addresses", () => {
    expect(appLink("/settle?commune=c1", "https://app.ourcommune.io")).toBe("https://app.ourcommune.io/settle?commune=c1");
  });
});
