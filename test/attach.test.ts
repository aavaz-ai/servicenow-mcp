import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  MAX_INLINE_BYTES,
  resolveUploadBytes,
  definition,
} from "../src/tools/attach";

// Guards the inline-content upload path. Before this, upload could only read
// from a local file_path, which is unusable when the MCP server runs remotely
// or sandboxed with no filesystem shared with the caller.
describe("resolveUploadBytes", () => {
  it("decodes inline base64 content", () => {
    const content = Buffer.from("hello servicenow").toString("base64");
    const result = resolveUploadBytes({ content, file_name: "note.txt" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.toString()).toBe("hello servicenow");
    expect(result.filename).toBe("note.txt");
  });

  it("requires file_name when uploading via content", () => {
    const content = Buffer.from("x").toString("base64");
    const result = resolveUploadBytes({ content });
    expect(result).toEqual({
      error: "file_name is required when uploading via content (base64)",
    });
  });

  it("requires either content or file_path", () => {
    expect(resolveUploadBytes({})).toEqual({
      error: "either file_path or content (base64) is required for upload",
    });
  });

  it("rejects inline content over the size cap", () => {
    // Buffer of cap+1 bytes, base64-encoded.
    const oversized = Buffer.alloc(MAX_INLINE_BYTES + 1, 0x41).toString("base64");
    const result = resolveUploadBytes({
      content: oversized,
      file_name: "big.bin",
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("inline limit");
    expect(result.error).toContain("file_path");
  });

  it("still reads from file_path, defaulting file_name to the basename", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-attach-"));
    const filePath = path.join(dir, "evidence.txt");
    fs.writeFileSync(filePath, "from disk");
    try {
      const result = resolveUploadBytes({ file_path: filePath });
      expect("error" in result).toBe(false);
      if ("error" in result) return;
      expect(result.data.toString()).toBe("from disk");
      expect(result.filename).toBe("evidence.txt");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lets file_name override the basename for file_path uploads", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sn-attach-"));
    const filePath = path.join(dir, "tmp123.bin");
    fs.writeFileSync(filePath, "x");
    try {
      const result = resolveUploadBytes({
        file_path: filePath,
        file_name: "report.pdf",
      });
      expect("error" in result).toBe(false);
      if ("error" in result) return;
      expect(result.filename).toBe("report.pdf");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors clearly when file_path does not exist", () => {
    const result = resolveUploadBytes({ file_path: "/nope/missing.txt" });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("File not found");
  });

  it("prefers content over file_path when both are given", () => {
    const content = Buffer.from("inline wins").toString("base64");
    const result = resolveUploadBytes({
      content,
      file_name: "a.txt",
      file_path: "/nope/missing.txt",
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.toString()).toBe("inline wins");
  });
});

describe("attach tool schema", () => {
  it("advertises the inline content + return_content inputs", () => {
    const props = definition.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("content");
    expect(props).toHaveProperty("file_name");
    expect(props).toHaveProperty("return_content");
    // Backward compatible: the local-filesystem inputs remain.
    expect(props).toHaveProperty("file_path");
    expect(props).toHaveProperty("output_path");
  });
});
