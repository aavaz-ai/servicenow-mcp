import { z } from "zod";
import { ServiceNowClient } from "../client.js";
import { ServiceNowConfig } from "../config.js";
import { ok, err, formatError } from "../utils.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Cap on inline (base64) payloads in either direction.
 *
 * Inline bytes travel through the MCP JSON-RPC message, which for an agent
 * means they land in the model's context. Base64 also inflates by ~33%, so a
 * few MB of attachment becomes an enormous number of tokens. ServiceNow itself
 * accepts much larger files — this limit protects the transport/context, not
 * the API. Callers with a real filesystem should use file_path / output_path,
 * which stream through a Buffer and are not subject to this cap.
 */
export const MAX_INLINE_BYTES = 4 * 1024 * 1024;

function humanBytes(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Resolve the bytes to upload from either inline base64 `content` or a local
 * `file_path`. Exported for testing.
 *
 * `content` wins when both are supplied. Returns an error string instead of
 * throwing so the tool handler can surface it verbatim.
 */
export function resolveUploadBytes(args: {
  content?: string;
  file_name?: string;
  file_path?: string;
}): { data: Buffer; filename: string } | { error: string } {
  if (args.content !== undefined) {
    if (!args.file_name) {
      return {
        error: "file_name is required when uploading via content (base64)",
      };
    }
    let data: Buffer;
    try {
      data = Buffer.from(args.content, "base64");
    } catch {
      return { error: "content is not valid base64" };
    }
    if (data.length === 0 && args.content.length > 0) {
      return { error: "content is not valid base64" };
    }
    if (data.length > MAX_INLINE_BYTES) {
      return {
        error:
          `Inline content is ${humanBytes(data.length)}, over the ` +
          `${humanBytes(MAX_INLINE_BYTES)} inline limit. Use file_path instead.`,
      };
    }
    return { data, filename: args.file_name };
  }

  if (!args.file_path) {
    return { error: "either file_path or content (base64) is required for upload" };
  }
  if (!fs.existsSync(args.file_path)) {
    return { error: `File not found: ${args.file_path}` };
  }
  return {
    data: fs.readFileSync(args.file_path),
    filename: args.file_name || path.basename(args.file_path),
  };
}

export const definition = {
  name: "manage_attachments",
  title: "Manage attachments",
  description:
    "Manage attachments on ServiceNow records. List, download, or upload attachments. " +
    "Upload accepts either a local file_path or inline base64 content — use content " +
    "when this server has no filesystem in common with you (e.g. you generated the " +
    "file yourself). Download writes to output_path, or returns base64 inline with " +
    "return_content.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["list", "download", "upload"],
        description: "Attachment operation: list, download, or upload",
      },
      table: {
        type: "string",
        description: "Table name (required for list and upload)",
      },
      sys_id: {
        type: "string",
        description: "Record sys_id (required for list and upload)",
      },
      attachment_sys_id: {
        type: "string",
        description: "Attachment sys_id (required for download)",
      },
      output_path: {
        type: "string",
        description:
          "Local file path to save the downloaded attachment. Omit and set " +
          "return_content=true to get the bytes back inline instead.",
      },
      return_content: {
        type: "boolean",
        description:
          "For download: return the bytes as base64 in the response instead of " +
          "writing to output_path. Use this when you have no local filesystem. " +
          `Capped at ${humanBytes(MAX_INLINE_BYTES)}.`,
      },
      file_path: {
        type: "string",
        description: "Local file path to upload (alternative to content)",
      },
      content: {
        type: "string",
        description:
          "For upload: base64-encoded file bytes, uploaded directly with no local " +
          "file. Requires file_name. Use this when the file exists only in your " +
          `context, not on this server's disk. Capped at ${humanBytes(MAX_INLINE_BYTES)}.`,
      },
      file_name: {
        type: "string",
        description:
          "Attachment file name. Required when uploading via content; optional with " +
          "file_path (defaults to the file's basename).",
      },
      content_type: {
        type: "string",
        description: "MIME type for upload (default: application/octet-stream)",
      },
    },
    required: ["action"],
  },
};

export const schema = z.object({
  action: z.enum(["list", "download", "upload"]),
  table: z.string().optional(),
  sys_id: z.string().optional(),
  attachment_sys_id: z.string().optional(),
  output_path: z.string().optional(),
  return_content: z.boolean().optional(),
  file_path: z.string().optional(),
  content: z.string().optional(),
  file_name: z.string().optional(),
  content_type: z.string().optional(),
});

export async function handler(
  args: z.infer<typeof schema>,
  client: ServiceNowClient,
  _config: ServiceNowConfig
) {
  try {
    switch (args.action) {
      case "list": {
        if (!args.table || !args.sys_id) {
          return err("table and sys_id are required for listing attachments");
        }
        const resp = await client.get("/api/now/attachment", {
          sysparm_query: `table_name=${args.table}^table_sys_id=${args.sys_id}`,
        });
        const attachments = (resp.result || []).map(
          (a: Record<string, string>) => ({
            sys_id: a.sys_id,
            file_name: a.file_name,
            size_bytes: a.size_bytes,
            content_type: a.content_type,
            download_link: a.download_link,
          })
        );
        return ok(attachments);
      }

      case "download": {
        if (!args.attachment_sys_id) {
          return err("attachment_sys_id is required for download");
        }
        if (!args.output_path && !args.return_content) {
          return err(
            "either output_path or return_content=true is required for download"
          );
        }
        const { data, contentType } = await client.getRaw(
          `/api/now/attachment/${args.attachment_sys_id}/file`
        );
        if (args.return_content) {
          if (data.length > MAX_INLINE_BYTES) {
            return err(
              `Attachment is ${humanBytes(data.length)}, over the ` +
                `${humanBytes(MAX_INLINE_BYTES)} inline limit. ` +
                `Use output_path to write it to disk instead.`
            );
          }
          return ok({
            status: "downloaded",
            size_bytes: data.length,
            content_type: contentType,
            encoding: "base64",
            content: data.toString("base64"),
          });
        }
        fs.writeFileSync(args.output_path as string, data);
        return ok({
          status: "downloaded",
          path: args.output_path,
          size_bytes: data.length,
        });
      }

      case "upload": {
        if (!args.table || !args.sys_id) {
          return err("table and sys_id are required for upload");
        }
        const resolved = resolveUploadBytes({
          content: args.content,
          file_name: args.file_name,
          file_path: args.file_path,
        });
        if ("error" in resolved) {
          return err(resolved.error);
        }
        const contentType = args.content_type || "application/octet-stream";

        const resp = await client.postBinary(
          "/api/now/attachment/file",
          resolved.data,
          contentType,
          {
            table_name: args.table,
            table_sys_id: args.sys_id,
            file_name: resolved.filename,
          }
        );
        const result = resp.result || {};
        return ok({
          sys_id: result.sys_id,
          file_name: result.file_name,
          size_bytes: result.size_bytes,
          table_name: result.table_name,
          table_sys_id: result.table_sys_id,
        });
      }

      default:
        return err(`Unknown attachment action: ${args.action}`);
    }
  } catch (error) {
    return err(formatError(error));
  }
}
