// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  defaultCallingCode, inviteMessage, sentViaWords, textLink, whatsAppLink, whatsAppNumber, withInviteLink,
} from "@commune/core";

describe("inviting someone from your contacts", () => {
  it("reads UK numbers however they were saved", () => {
    for (const raw of ["07700 900412", "+44 7700 900412", "0044 7700 900412", "+44 (0)7700 900412", "(07700) 900-412"]) {
      expect(whatsAppNumber(raw, "44"), raw).toBe("447700900412");
    }
  });

  it("reads US numbers in a dollar commune", () => {
    expect(whatsAppNumber("(415) 555-0132", "1")).toBe("14155550132");
    expect(whatsAppNumber("1 415 555 0132", "1")).toBe("14155550132");
    expect(whatsAppNumber("+1 415 555 0132", null)).toBe("14155550132");
  });

  it("gives up rather than guessing", () => {
    expect(whatsAppNumber("07700 900412", null)).toBeNull();
    expect(whatsAppNumber("12345", "44")).toBeNull();
    expect(whatsAppNumber("", "44")).toBeNull();
    expect(whatsAppNumber(null)).toBeNull();
  });

  it("assumes a calling code only for pounds and dollars", () => {
    expect(defaultCallingCode("GBP")).toBe("44");
    expect(defaultCallingCode("USD")).toBe("1");
    expect(defaultCallingCode("EUR")).toBeNull();
  });

  it("writes the message as the sender would, with the link added on sending", () => {
    const url = "https://app.ourcommune.io/invite?token=abc";
    const message = inviteMessage({ name: "Maya Okafor", communeName: "Elm Road", kind: "household" });
    expect(message).toBe("Hey Maya, join Elm Road on Commune so we can keep bills and chores fair.");
    expect(withInviteLink(message, url)).toBe(`${message}\n${url}`);
    expect(withInviteLink("  ", url)).toBe(url);
    expect(inviteMessage({ name: " ", communeName: "Lisbon", kind: "trip" })).toBe("Hi, join Lisbon on Commune so we can keep trip costs fair.");
  });

  it("opens WhatsApp on their chat, or the chat picker without a number", () => {
    expect(whatsAppLink("447700900412", "Hey & hello")).toBe("https://wa.me/447700900412?text=Hey%20%26%20hello");
    expect(whatsAppLink(null, "Hi")).toBe("https://wa.me/?text=Hi");
  });

  it("writes text links the way each phone reads them", () => {
    expect(textLink("+44 7700 900412", "Hi there", true)).toBe("sms:+447700900412&body=Hi%20there");
    expect(textLink("07700 900412", "Hi there", false)).toBe("sms:07700900412?body=Hi%20there");
  });

  it("says how each invitation went", () => {
    expect(sentViaWords("whatsapp")).toBe("Sent on WhatsApp");
    expect(sentViaWords("text")).toBe("Sent by text");
    expect(sentViaWords(null)).toBe("Link shared");
  });
});
