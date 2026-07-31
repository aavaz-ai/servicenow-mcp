import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceNowClient } from "../src/client";
import type { ServiceNowConfig } from "../src/config";

const base: ServiceNowConfig = {
  instance: "https://acme.service-now.com",
  displayValue: "true",
  relDepth: 3,
};

function mockFetchOnce(body: unknown = { result: [] }) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Map<string, string>(),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("ServiceNowClient auth header", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends a Bearer header when oauthBearer is set", async () => {
    const fetchMock = mockFetchOnce();
    const client = new ServiceNowClient({ ...base, oauthBearer: "tok-123" });
    await client.get("/api/now/table/incident");
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });

  it("sends a Basic header when user/password are set (no bearer)", async () => {
    const fetchMock = mockFetchOnce();
    const client = new ServiceNowClient({ ...base, user: "u", password: "p" });
    await client.get("/api/now/table/incident");
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Basic " + Buffer.from("u:p").toString("base64"));
  });

  it("prefers the bearer over Basic when both are present", async () => {
    const fetchMock = mockFetchOnce();
    const client = new ServiceNowClient({ ...base, oauthBearer: "tok", user: "u", password: "p" });
    await client.get("/api/now/table/incident");
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
  });
});
