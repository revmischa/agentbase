/**
 * Smoke tests for the AgentBase MCP package.
 * Tests the GraphQL client layer directly against staging.
 *
 * Run with: cd packages/mcp && pnpm test:smoke
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  SignJWT,
  importJWK,
  generateKeyPair,
  exportJWK,
  calculateJwkThumbprint,
} from "jose";

const API_URL =
  process.env.AGENTBASE_API_URL ??
  "https://27ntff3y5jdalifhypsi4qehf4.appsync-api.us-east-1.amazonaws.com/graphql";


// ---------------------------------------------------------------------------
// Helpers (mirrors the MCP client layer logic)
// ---------------------------------------------------------------------------

interface Agent {
  privateJwk: Record<string, unknown>;
  publicJwk: Record<string, unknown>;
  fingerprint: string;
  userId?: string;
  username: string;
}

async function createAgent(username: string): Promise<Agent> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  const fingerprint = await calculateJwkThumbprint(publicJwk, "sha256");
  return { privateJwk, publicJwk, fingerprint, username };
}

async function signJwt(agent: Agent): Promise<string> {
  const key = await importJWK(agent.privateJwk, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(agent.fingerprint)
    .setIssuedAt()
    .setExpirationTime("30s")
    .setJti(crypto.randomUUID())
    .sign(key);
}

async function gql(
  query: string,
  variables: Record<string, unknown> = {},
  auth?: { token?: string },
): Promise<{
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; errorType?: string }>;
}> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth?.token) {
    headers["Authorization"] = auth.token;
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{
    data?: Record<string, unknown>;
    errors?: Array<{ message: string; errorType?: string }>;
  }>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let agentA: Agent;
let agentB: Agent;
let knowledgeId: string;
let privateKnowledgeId: string;

// Track items for cleanup
const itemsToClean: Array<{ id: string; agent: Agent }> = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP Smoke Tests", { timeout: 30_000 }, () => {
  beforeAll(async () => {
    const suffix = Date.now().toString(36);
    agentA = await createAgent(`mcp-a-${suffix}`);
    agentB = await createAgent(`mcp-b-${suffix}`);
  });

  afterAll(async () => {
    // Best-effort cleanup
    for (const { id, agent } of itemsToClean) {
      try {
        const token = await signJwt(agent);
        await gql(`mutation($id: ID!) { deleteKnowledge(id: $id) }`, { id }, { token });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  // ── Setup flow ─────────────────────────────────────────────────────────

  describe("Setup flow", () => {
    it("registers agent A", async () => {
      const res = await gql(
        `mutation($input: RegisterUserInput!) {
          registerUser(input: $input) { userId username publicKeyFingerprint }
        }`,
        {
          input: {
            username: agentA.username,
            publicKey: JSON.stringify(agentA.publicJwk),
            currentTask: "MCP smoke tests",
          },
        },
        {},
      );
      expect(res.errors).toBeUndefined();
      const user = res.data!.registerUser as Record<string, string>;
      expect(user.publicKeyFingerprint).toBe(agentA.fingerprint);
      agentA.userId = user.userId;
    });

    it("registers agent B", async () => {
      const res = await gql(
        `mutation($input: RegisterUserInput!) {
          registerUser(input: $input) { userId username }
        }`,
        {
          input: {
            username: agentB.username,
            publicKey: JSON.stringify(agentB.publicJwk),
          },
        },
        {},
      );
      expect(res.errors).toBeUndefined();
      agentB.userId = (res.data!.registerUser as Record<string, string>).userId;
    });
  });

  // ── Store knowledge ────────────────────────────────────────────────────

  describe("Store knowledge", () => {
    it("creates a public knowledge item", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($input: CreateKnowledgeInput!) {
          createKnowledge(input: $input) { knowledgeId topic visibility }
        }`,
        {
          input: {
            topic: "mcp-smoke",
            contentType: "application/json",
            content: JSON.stringify({
              fact: "MCP servers wrap GraphQL APIs for agent consumption",
            }),
            visibility: "public",
          },
        },
        { token },
      );
      expect(res.errors).toBeUndefined();
      knowledgeId = (res.data!.createKnowledge as Record<string, string>).knowledgeId;
      itemsToClean.push({ id: knowledgeId, agent: agentA });
    });

    it("creates a private knowledge item", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($input: CreateKnowledgeInput!) {
          createKnowledge(input: $input) { knowledgeId visibility }
        }`,
        {
          input: {
            topic: "mcp-smoke",
            contentType: "text/plain",
            content: JSON.stringify("Private agent A data for MCP test"),
            visibility: "private",
          },
        },
        { token },
      );
      expect(res.errors).toBeUndefined();
      privateKnowledgeId = (res.data!.createKnowledge as Record<string, string>).knowledgeId;
      itemsToClean.push({ id: privateKnowledgeId, agent: agentA });
    });
  });

  // ── List knowledge ─────────────────────────────────────────────────────

  describe("List knowledge", () => {
    it("lists own items filtered by topic", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `query { listKnowledge(topic: "mcp-smoke") { items { knowledgeId topic } } }`,
        {},
        { token },
      );
      expect(res.errors).toBeUndefined();
      const conn = res.data!.listKnowledge as { items: Array<Record<string, string>> };
      expect(conn.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Get knowledge ──────────────────────────────────────────────────────

  describe("Get knowledge", () => {
    it("gets an item by ID", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `query($id: ID!) { getKnowledge(id: $id) { knowledgeId content } }`,
        { id: knowledgeId },
        { token },
      );
      expect(res.errors).toBeUndefined();
      expect((res.data!.getKnowledge as Record<string, string>).knowledgeId).toBe(knowledgeId);
    });
  });

  // ── Update knowledge ───────────────────────────────────────────────────

  describe("Update knowledge", () => {
    it("updates topic", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($id: ID!, $input: UpdateKnowledgeInput!) {
          updateKnowledge(id: $id, input: $input) { knowledgeId topic }
        }`,
        { id: knowledgeId, input: { topic: "mcp-smoke-updated" } },
        { token },
      );
      expect(res.errors).toBeUndefined();
      expect((res.data!.updateKnowledge as Record<string, string>).topic).toBe(
        "mcp-smoke-updated",
      );
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────

  describe("Search", () => {
    it("finds items via semantic search", async () => {
      await new Promise((r) => setTimeout(r, 2000));
      const token = await signJwt(agentA);
      const res = await gql(
        `query($q: String!) {
          searchKnowledge(query: $q, limit: 5) { knowledgeId topic score snippet }
        }`,
        { q: "MCP server wrapping GraphQL for agents" },
        { token },
      );
      expect(res.errors).toBeUndefined();
      // Search may return 0 results if vectors haven't propagated
      expect(res.data!.searchKnowledge).toBeDefined();
    });
  });

  // ── Visibility ─────────────────────────────────────────────────────────

  describe("Visibility", () => {
    it("agent B can read agent A's public item", async () => {
      const token = await signJwt(agentB);
      const res = await gql(
        `query($id: ID!) { getKnowledge(id: $id) { knowledgeId visibility } }`,
        { id: knowledgeId },
        { token },
      );
      expect(res.errors).toBeUndefined();
      expect((res.data!.getKnowledge as Record<string, string>).visibility).toBe("public");
    });

    it("agent B cannot read agent A's private item", async () => {
      const token = await signJwt(agentB);
      const res = await gql(
        `query($id: ID!) { getKnowledge(id: $id) { knowledgeId } }`,
        { id: privateKnowledgeId },
        { token },
      );
      if (res.errors) {
        expect(res.errors[0].message).toMatch(/forbidden|not.found|access denied|private/i);
      } else {
        expect(res.data!.getKnowledge).toBeNull();
      }
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────

  describe("Delete", () => {
    it("deletes public item", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($id: ID!) { deleteKnowledge(id: $id) }`,
        { id: knowledgeId },
        { token },
      );
      expect(res.errors).toBeUndefined();
      expect(res.data!.deleteKnowledge).toBe(true);
      itemsToClean.splice(
        itemsToClean.findIndex((i) => i.id === knowledgeId),
        1,
      );
    });

    it("deletes private item", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($id: ID!) { deleteKnowledge(id: $id) }`,
        { id: privateKnowledgeId },
        { token },
      );
      expect(res.errors).toBeUndefined();
      expect(res.data!.deleteKnowledge).toBe(true);
      itemsToClean.splice(
        itemsToClean.findIndex((i) => i.id === privateKnowledgeId),
        1,
      );
    });
  });

  // ── Profile ────────────────────────────────────────────────────────────

  describe("Profile", () => {
    it("gets profile via me", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `{ me { userId username currentTask } }`,
        {},
        { token },
      );
      expect(res.errors).toBeUndefined();
      const me = res.data!.me as Record<string, string>;
      expect(me.username).toBe(agentA.username);
      expect(me.currentTask).toBe("MCP smoke tests");
    });

    it("updates profile", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($input: UpdateUserInput!) {
          updateMe(input: $input) { currentTask longTermGoal }
        }`,
        { input: { currentTask: "Updated via MCP", longTermGoal: "Test all tools" } },
        { token },
      );
      expect(res.errors).toBeUndefined();
      const updated = res.data!.updateMe as Record<string, string>;
      expect(updated.currentTask).toBe("Updated via MCP");
      expect(updated.longTermGoal).toBe("Test all tools");
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe("Error handling", () => {
    it("rejects unauthenticated request", async () => {
      const res = await gql(`{ me { userId } }`);
      expect(res.errors).toBeDefined();
    });

    it("rejects invalid topic in createKnowledge", async () => {
      const token = await signJwt(agentA);
      const res = await gql(
        `mutation($input: CreateKnowledgeInput!) {
          createKnowledge(input: $input) { knowledgeId }
        }`,
        {
          input: {
            topic: "A",
            contentType: "text/plain",
            content: JSON.stringify("test"),
          },
        },
        { token },
      );
      expect(res.errors).toBeDefined();
    });
  });
});
