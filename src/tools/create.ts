import { z } from "zod";
import { ServiceNowClient } from "../client.js";
import { ServiceNowConfig } from "../config.js";
import { ok, err, formatError, buildWriteParams } from "../utils.js";

export const definition = {
  name: "create_record",
  title: "Create record",
  description:
    "Create a new record on any ServiceNow table. Pass field values as a JSON object. " +
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
      fields: {
        type: "object",
        description:
          'JSON object of field name/value pairs (e.g. {"short_description":"Server down","urgency":"1"})',
        additionalProperties: true,
      },
      input_display_value: {
        type: "boolean",
        description:
          "Interpret the values you send as DISPLAY labels instead of stored values " +
          '(e.g. "Joe Employee" instead of a sys_id). WARNING: this is request-level, ' +
          "not per-field — it applies to EVERY field in `fields`. You cannot mix " +
          "display labels and stored values in one call. Leave false and send stored " +
          "values unless every value you are sending is a display label.",
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
    required: ["table", "fields"],
  },
};

export const schema = z.object({
  table: z.string(),
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
    const resp = await client.post(
      `/api/now/table/${args.table}`,
      args.fields,
      Object.keys(params).length > 0 ? params : undefined
    );
    const result = resp.result || {};
    return ok({
      sys_id: result.sys_id,
      number: result.number,
      result,
    });
  } catch (error) {
    return err(formatError(error));
  }
}
