// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exactConnectPolicy } from "../vite.config";

type VercelConfig = { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as VercelConfig;
const headers = new Map(vercel.headers.find((rule) => rule.source === "/(.*)")?.headers.map((header) => [header.key, header.value]));
const policy = new Map((headers.get("Content-Security-Policy") ?? "").split(";").map((part) => {
  const [name, ...values] = part.trim().split(/\s+/);
  return [name, values] as const;
}));

describe("hosted security headers", () => {
  it("stops other sites framing the app and keeps scripts to the app's own files", () => {
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(policy.get("script-src")).toEqual(["'self'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'none'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect([...policy.values()].flat()).not.toContain("'unsafe-inline'");
    expect([...policy.values()].flat()).not.toContain("'unsafe-eval'");
  });

  it("sends nosniff, a referrer policy and a permissions policy", () => {
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });
});

describe("the build's exact connect policy", () => {
  const html = '<head>\n    <meta charset="UTF-8" />\n</head>';
  const transform = (env: Record<string, string>) => {
    const hook = exactConnectPolicy(env).transformIndexHtml as (html: string) => string;
    return hook(html);
  };

  it("names only the Neon endpoints the build was configured with", () => {
    const out = transform({
      VITE_NEON_AUTH_URL: "https://ep-a.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth",
      VITE_NEON_DATA_API_URL: "https://ep-a.apirest.c-2.eu-west-2.aws.neon.tech/neondb/rest/v1",
      VITE_REMINDER_FUNCTION_URL: " https://br-a.compute.eu-west-2.aws.neon.tech ",
    });
    expect(out).toContain(`<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="connect-src 'self' `
      + "https://ep-a.neonauth.c-2.eu-west-2.aws.neon.tech https://ep-a.apirest.c-2.eu-west-2.aws.neon.tech https://br-a.compute.eu-west-2.aws.neon.tech\" />");
  });

  it("adds nothing to a build without Neon endpoints, such as the local app", () => {
    expect(transform({})).toBe(html);
  });
});
