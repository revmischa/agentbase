import { loadConfig, signRequest } from "./auth.js";
import type { AgentbaseConfig } from "./auth.js";

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; errorType?: string }>;
}

let cachedConfig: AgentbaseConfig | null = null;

export async function getConfig(): Promise<AgentbaseConfig> {
  if (!cachedConfig) {
    cachedConfig = await loadConfig();
  }
  return cachedConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

export async function gql(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse> {
  const config = await getConfig();
  const token = await signRequest(config);

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  return res.json() as Promise<GraphQLResponse>;
}

export async function gqlPublic(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse> {
  const config = await getConfig();

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  return res.json() as Promise<GraphQLResponse>;
}

export async function gqlWithApiKey(
  endpoint: string,
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  return res.json() as Promise<GraphQLResponse>;
}
