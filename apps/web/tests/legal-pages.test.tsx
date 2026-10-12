import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "../src/App";
import { AppProvider } from "../src/state";
import { api } from "../src/live/api";

vi.mock("../src/live/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/live/api")>(),
  api: vi.fn(),
}));

function mount(path: string) {
  const location = memoryLocation({ path, record: true });
  render(<Router hook={location.hook}><AppProvider><App /></AppProvider></Router>);
  return location;
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: null };
    throw new Error(`Unexpected API request ${path}`);
  });
});
afterEach(cleanup);

describe("privacy and terms", () => {
  it("shows the privacy page to someone who is signed out, with the services used and a contact", async () => {
    const location = mount("/privacy");
    const page = await screen.findByRole("article");
    expect(within(page).getByRole("heading", { level: 1, name: "Privacy" })).toBeTruthy();
    for (const service of ["Neon", "Vercel", "Resend", "Google", "Unsplash"]) expect(page.textContent).toContain(service);
    expect(within(page).getAllByRole("link", { name: "support@ourcommune.io" })[0].getAttribute("href")).toBe("mailto:support@ourcommune.io");
    expect(location.history).toEqual(["/privacy"]);
  });

  it("shows the terms page to someone who is signed out", async () => {
    const location = mount("/terms");
    expect(await screen.findByRole("heading", { level: 1, name: "Terms of use" })).toBeTruthy();
    expect(screen.getByText(/Commune does not move money/)).toBeTruthy();
    expect(location.history).toEqual(["/terms"]);
  });

  it("links sign-up and the sign-in pages to both pages", async () => {
    mount("/signup");
    await screen.findByRole("heading", { name: "Create your account" });
    expect(screen.getByRole("link", { name: "privacy notice" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getAllByRole("link", { name: "Privacy" }).every((link) => link.getAttribute("href") === "/privacy")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Terms" }).every((link) => link.getAttribute("href") === "/terms")).toBe(true);
  });
});
