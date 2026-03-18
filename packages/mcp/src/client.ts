import { signRequest } from "./auth.js";
import type { JWK } from "jose";

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; errorType?: string }>;
}

const GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_ENDPOINT ??
  "https://27ntff3y5jdalifhypsi4qehf4.appsync-api.us-east-1.amazonaws.com/graphql";

export async function gql(
  privateKey: JWK,
  publicKey: JWK,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse> {
  const token = await signRequest(privateKey, publicKey);

  const res = await fetch(GRAPHQL_ENDPOINT, {
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
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer anonymous",
    },
    body: JSON.stringify({ query, variables }),
  });

  return res.json() as Promise<GraphQLResponse>;
}
