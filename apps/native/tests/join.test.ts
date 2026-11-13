// @vitest-environment node
import { describe, expect, it } from "vitest";
import { demoBackend } from "../src/lib/demo";
import { needs } from "../src/lib/derive";
import type { Snapshot } from "../src/lib/types";

const TODAY = "2026-10-11";

describe("joining from an invitation (demo)", () => {
  it("previews the invitation, joins once, and only today's shares are yours", async () => {
    const backend = demoBackend(() => TODAY);
    const user = (await backend.me())!;
    const preview = await backend.previewInvite("demo");
    expect(preview?.communeName).toBe("22 Elm Road");
    expect(preview?.inviterName).toBe("Sam Okafor");

    const id = await backend.acceptInvite("demo");
    expect(id).toBe("demo-elm");
    expect(await backend.acceptInvite("demo")).toBe("demo-elm");
    expect(await backend.previewInvite("demo")).toBeNull();

    const communes = await backend.communes();
    expect(communes.filter((commune) => commune.id === "demo-elm")).toHaveLength(1);
    const snapshots: Snapshot[] = await Promise.all(communes.map((commune) => backend.snapshot(commune)));
    const mine = needs(snapshots, user.id, TODAY).filter((need) => need.communeId === "demo-elm");
    expect(mine.map((need) => need.title)).toContain("Broadband");
    expect(mine.some((need) => need.kind === "share" && need.amountMinor === 1000)).toBe(true);
  });

  it("refuses an unknown invitation", async () => {
    const backend = demoBackend(() => TODAY);
    expect(await backend.previewInvite("nope")).toBeNull();
    await expect(backend.acceptInvite("nope")).rejects.toThrow(/expired or been used/);
  });
});
