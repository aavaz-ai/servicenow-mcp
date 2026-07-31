/**
 * Configuration — reads ServiceNow credentials from environment variables.
 *
 * @module config
 */

export interface ServiceNowConfig {
  instance: string;
  // Basic-auth credentials. Optional when oauthBearer is set.
  user?: string;
  password?: string;
  // OAuth 2.0 bearer access token supplied via env (e.g. by a broker like Nango
  // in the Enterpret connector `bring_token` path). When set, the client uses
  // `Authorization: Bearer <token>` and ignores user/password.
  oauthBearer?: string;
  displayValue: string;
  relDepth: number;
}

/**
 * Load and validate configuration from environment variables.
 * Throws descriptive errors when required variables are missing.
 */
export function loadConfig(): ServiceNowConfig {
  const instance = process.env.SN_INSTANCE;
  const user = process.env.SN_USER;
  const password = process.env.SN_PASSWORD;
  // OAuth bearer access token supplied via env (e.g. by Nango in the Enterpret
  // connector `bring_token` path). When present, it takes precedence over Basic auth.
  const oauthBearer = process.env.SN_OAUTH_BEARER;
  const displayValue = process.env.SN_DISPLAY_VALUE ?? "true";
  const relDepth = parseInt(process.env.SN_REL_DEPTH ?? "3", 10);

  const missing: string[] = [];
  if (!instance) missing.push("SN_INSTANCE");
  // Auth: accept either an OAuth bearer, or a Basic-auth user+password pair.
  if (!oauthBearer && (!user || !password)) {
    missing.push("SN_OAUTH_BEARER (or SN_USER + SN_PASSWORD)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}\n\n` +
        "Set them in your MCP client configuration:\n" +
        '  SN_INSTANCE      — ServiceNow instance URL (e.g. https://yourinstance.service-now.com)\n' +
        '  SN_OAUTH_BEARER  — OAuth access token (headless / broker-supplied); OR\n' +
        '  SN_USER          — ServiceNow username (Basic auth)\n' +
        '  SN_PASSWORD      — ServiceNow password (Basic auth)\n'
    );
  }

  // Normalize instance URL: strip trailing slash, ensure https://
  let normalizedInstance = instance!.replace(/\/+$/, "");
  if (!normalizedInstance.startsWith("http")) {
    normalizedInstance = `https://${normalizedInstance}`;
  }

  return {
    instance: normalizedInstance,
    user,
    password,
    oauthBearer,
    displayValue,
    relDepth: isNaN(relDepth) ? 3 : relDepth,
  };
}
