/**
 * Shared utilities for tool handlers.
 *
 * @module utils
 */

/**
 * Format a successful tool result as MCP text content.
 */
export function ok(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/**
 * Format an error tool result as MCP text content.
 */
export function err(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return { content: [{ type: "text", text: `ERROR: ${message}` }], isError: true };
}

/**
 * Safely format a ServiceNow error for display.
 */
export function formatError(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (e.message) {
      let msg = String(e.message);
      if (e.detail) msg += `\nDetail: ${e.detail}`;
      if (e.status) msg += ` (HTTP ${e.status})`;
      return msg;
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Build a query parameter map for table API requests.
 */
export function buildTableParams(opts: {
  query?: string;
  fields?: string;
  limit?: number;
  offset?: number;
  orderby?: string;
  displayValue?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (opts.limit !== undefined) params.sysparm_limit = String(opts.limit);
  if (opts.query) params.sysparm_query = opts.query;
  if (opts.fields) params.sysparm_fields = opts.fields;
  if (opts.offset !== undefined) params.sysparm_offset = String(opts.offset);
  if (opts.orderby) params.sysparm_orderby = opts.orderby;
  if (opts.displayValue) params.sysparm_display_value = opts.displayValue;
  return params;
}

/**
 * Build sysparm_* query params for write calls (create / update).
 *
 * ServiceNow accepts these on POST/PATCH/PUT just as it does on GET, so they
 * control both how the request body is interpreted and how the response is
 * shaped.
 *
 * NOTE on `inputDisplayValue`: sysparm_input_display_value is request-level,
 * not per-field — it applies to EVERY field in the body. Enabling it means all
 * values must be display labels ("1 - High", "Joe Employee"), not stored values
 * ("1", a sys_id). Mixing the two in one call is not possible; ServiceNow
 * silently drops values it cannot resolve. Prefer sending stored values with
 * this flag off.
 */
export function buildWriteParams(opts: {
  inputDisplayValue?: boolean;
  displayValue?: string;
  fields?: string;
  excludeReferenceLink?: boolean;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (opts.inputDisplayValue) params.sysparm_input_display_value = "true";
  if (opts.displayValue) params.sysparm_display_value = opts.displayValue;
  if (opts.fields) params.sysparm_fields = opts.fields;
  if (opts.excludeReferenceLink) params.sysparm_exclude_reference_link = "true";
  return params;
}

/**
 * Truncate a string if it exceeds maxLen, appending "...".
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}
