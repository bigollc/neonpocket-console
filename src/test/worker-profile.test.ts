import { describe, expect, it } from "vitest";
import worker from "../../workers/neon-proxy";

function makeEnv() {
  const insertBinds: unknown[][] = [];
  const env = {
    ALLOWED_ORIGINS: "https://app.example.com",
    ASSETS: { fetch: async () => new Response("asset") },
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            if (/INSERT INTO app_profiles/i.test(sql)) insertBinds.push(values);
            return { run: async () => ({ success: true }) };
          },
          run: async () => ({ success: true }),
        };
      },
    },
  };
  return { env, insertBinds };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

describe("Cloudflare Worker app profile sync", () => {
  it("requires bearer authorization before writing to D1", async () => {
    const { env, insertBinds } = makeEnv();
    const response = await worker.fetch(new Request("https://worker.example.com/api/app-profile", {
      method: "POST",
      headers: { "Origin": "https://app.example.com", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "victim@example.com" }),
    }), env as Parameters<typeof worker.fetch>[1]);

    expect(response.status).toBe(401);
    expect(insertBinds).toHaveLength(0);
  });

  it("derives the D1 profile id from the bearer token instead of trusting client identity fields", async () => {
    const { env, insertBinds } = makeEnv();
    const apiKey = "napi_real_user_key_123456789";
    const attackerHash = "attacker-controlled-profile-id";
    const response = await worker.fetch(new Request("https://worker.example.com/api/app-profile", {
      method: "POST",
      headers: {
        "Origin": "https://app.example.com",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email: "user@example.com",
        keyHash: attackerHash,
        keyHint: "wrong",
        settings: { cloudProfileSync: true },
      }),
    }), env as Parameters<typeof worker.fetch>[1]);

    expect(response.status).toBe(200);
    expect(insertBinds).toHaveLength(1);
    const expectedHash = await sha256Hex(apiKey);
    expect(insertBinds[0][0]).toBe(expectedHash);
    expect(insertBinds[0][3]).toBe(expectedHash);
    expect(insertBinds[0]).not.toContain(attackerHash);
    expect(insertBinds[0]).not.toContain("wrong");
  });
});
