import { z } from "zod";
import { ServiceNowClient } from "../client.js";
import { ServiceNowConfig } from "../config.js";
import { ok, err, formatError, buildWriteParams } from "../utils.js";

export const definition = {
  name: "update_record",
  title: "Update record",
  description:
    "Update an existing ServiceNow record. Pass the sys_id and field values to change. " +
    "By default values must be STORED values (choice codes, sys_ids) — ServiceNow " +
    "silently drops values it cannot resolve and still returns success, so read the " +
    "record back to confirm what persisted.",
  inputSchema: {
    type: "object" as const,
    properties: {
      table: {
        type: "string",
        description: "ServiceNow table name (e.g. incident)",
      },
      sys_id: {
        type: "string",
        description: "The sys_id of the record to update",
      },
      fields: {
        type: "object",
        description:
          'JSON object of field name/value pairs to update (e.g. {"state":"6","close_notes":"Fixed"})',
        additionalProperties: true,
      },
      input_display_value: {
        type: "boolean",
        description:
          "Interpret the values you send as DISPLAY labels instead of stored values. " +
          "WARNING: request-level, not per-field — it applies to EVERY field in " +
          "`fields`. You cannot mix display labels and stored values in one call.",
      },
      display_value: {
        type: "string",
        description:
          "Shape the RESPONSE: 'false' (stored values), 'true' (display labels), or " +
          "'all' (both). Use 'all' to verify what persisted without a second read.",
      },
      fields_to_return: {
        type: "string",
        description:
          "Comma-separated list of fields to return in the response (sysparm_fields).",
      },
      exclude_reference_link: {
        type: "boolean",
        description:
          "Strip the {value, link} wrapper from reference fields in the response.",
      },
    },
    required: ["table", "sys_id", "fields"],
  },
};

export const schema = z.object({
  table: z.string(),
  sys_id: z.string(),
  fields: z.record(z.unknown()),
  input_display_value: z.boolean().optional(),
  display_value: z.enum(["true", "false", "all"]).optional(),
  fields_to_return: z.string().optional(),
  exclude_reference_link: z.boolean().optional(),
});

export async function handler(
  args: z.infer<typeof schema>,
  client: ServiceNowClient,
  _config: ServiceNowConfig
) {
  try {
    const params = buildWriteParams({
      inputDisplayValue: args.input_display_value,
      displayValue: args.display_value,
      fields: args.fields_to_return,
      excludeReferenceLink: args.exclude_reference_link,
    });
    const resp = await client.patch(
      `/api/now/table/${args.table}/${args.sys_id}`,
      args.fields,
      Object.keys(params).length > 0 ? params : undefined
    );
    return ok(resp.result);
  } catch (error) {
    return err(formatError(error));
  }
}
