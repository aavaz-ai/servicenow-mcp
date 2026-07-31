import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

// loadConfig reads process.env directly, so snapshot + restore the relevant
// keys around every test to keep them isolated.
const KEYS = [
  "SERVICENOW_INSTANCE",
  "SN_INSTANCE",
  "SERVICENOW_OAUTH_BEARER",
  "SN_OAUTH_BEARER",
  "SN_USER",
  "SN_PASSWORD",
  "SN_DISPLAY_VALUE",
  "SN_REL_DEPTH",
];

describe("loadConfig", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe("auth selection", () => {
    it("uses SERVICENOW_OAUTH_BEARER when set", () => {
      process.env.SERVICENOW_INSTANCE = "acme";
      process.env.SERVICENOW_OAUTH_BEARER = "tok-123";
      expect(loadConfig().oauthBearer).toBe("tok-123");
    });

    it("falls back to SN_OAUTH_BEARER", () => {
      process.env.SERVICENOW_INSTANCE = "acme";
      process.env.SN_OAUTH_BEARER = "tok-legacy";
      expect(loadConfig().oauthBearer).toBe("tok-legacy");
    });

    it("prefers SERVICENOW_OAUTH_BEARER over SN_OAUTH_BEARER", () => {
      process.env.SERVICENOW_INSTANCE = "acme";
      process.env.SERVICENOW_OAUTH_BEARER = "new";
      process.env.SN_OAUTH_BEARER = "old";
      expect(loadConfig().oauthBearer).toBe("new");
    });

    it("accepts Basic auth (SN_USER + SN_PASSWORD) with no bearer", () => {
      process.env.SERVICENOW_INSTANCE = "acme";
      process.env.SN_USER = "u";
      process.env.SN_PASSWORD = "p";
      const cfg = loadConfig();
      expect(cfg.oauthBearer).toBeUndefined();
      expect(cfg.user).toBe("u");
      expect(cfg.password).toBe("p");
    });

    it("throws when neither bearer nor user+password is set", () => {
      process.env.SERVICENOW_INSTANCE = "acme";
      expect(() => loadConfig()).toThrow(/SERVICENOW_OAUTH_BEARER/);
    });

    it("throws when the instance is missing", () => {
      process.env.SERVICENOW_OAUTH_BEARER = "tok";
      expect(() => loadConfig()).toThrow(/SERVICENOW_INSTANCE/);
    });
  });

  describe("instance normalization", () => {
    beforeEach(() => {
      process.env.SERVICENOW_OAUTH_BEARER = "tok";
    });

    it("expands a bare subdomain to the ServiceNow host", () => {
      process.env.SERVICENOW_INSTANCE = "acme";
      expect(loadConfig().instance).toBe("https://acme.service-now.com");
    });

    it("prepends https:// to a full host", () => {
      process.env.SERVICENOW_INSTANCE = "acme.service-now.com";
      expect(loadConfig().instance).toBe("https://acme.service-now.com");
    });

    it("leaves a full URL unchanged (minus trailing slash)", () => {
      process.env.SERVICENOW_INSTANCE = "https://acme.service-now.com/";
      expect(loadConfig().instance).toBe("https://acme.service-now.com");
    });

    it("honors the SN_INSTANCE fallback and expands it", () => {
      process.env.SN_INSTANCE = "dev123";
      expect(loadConfig().instance).toBe("https://dev123.service-now.com");
    });
  });
});
