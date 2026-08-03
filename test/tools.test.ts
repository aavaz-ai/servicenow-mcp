import { describe, expect, it } from "vitest";
import { getToolDefinitions } from "../src/tools/index";

// Guards the connector-UI contract: every tool needs a clean programmatic name
// and a human-readable `title` (which the Enterpret connector UI renders instead
// of the raw name). Regression guard for the sn_* -> readable rename.
describe("tool definitions", () => {
  const defs = getToolDefinitions();

  it("exposes all 16 tools", () => {
    expect(defs.length).toBe(16);
  });

  it("every name is snake_case with no legacy sn_ prefix", () => {
    for (const d of defs) {
      expect(d.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(d.name.startsWith("sn_")).toBe(false);
    }
  });

  it("every tool has a non-empty, human-readable title", () => {
    for (const d of defs) {
      expect(typeof d.title).toBe("string");
      expect((d.title ?? "").length).toBeGreaterThan(0);
      // Title is a display label, not the wire name.
      expect(d.title).not.toBe(d.name);
    }
  });

  it("names and titles are unique", () => {
    expect(new Set(defs.map((d) => d.name)).size).toBe(defs.length);
    expect(new Set(defs.map((d) => d.title)).size).toBe(defs.length);
  });
});
