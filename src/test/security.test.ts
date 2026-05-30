import { afterEach, describe, expect, it, vi } from "vitest";
import { neonPathSegment } from "@/lib/neon/path";
import worker from "../../workers/neon-proxy";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Neon API path safety", () => {
  it("encodes valid path segments and rejects traversal or separator injection", () => {
    expect(neonPathSegment("br-main")).toBe("br-main");
    expect(neonPathSegment("role name")).toBe("role%20name");

    expect(() => neonPathSegment("../projects")).toThrow("Invalid Neon API path segment");
    expect(() => neonPathSegment("branch/other")).toThrow("Invalid Neon API path segment");
    expect(() => neonPathSegment("branch?limit=1")).toThrow("Invalid Neon API path segment");
  });

  it("blocks encoded traversal before proxying upstream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const response = await worker.fetch(new Request("https://worker.example.com/api/neon-proxy", {
      method: "POST",
      headers: {
        "Origin": "https://app.example.com",
        "Content-Type": "application/json",
        "Authorization": "Bearer napi_test_key",
      },
      body: JSON.stringify({ method: "GET", path: "/projects/%2e%2e/api_keys" }),
    }), {
      ALLOWED_ORIGINS: "https://app.example.com",
      ASSETS: { fetch: async () => new Response("asset") },
    });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
