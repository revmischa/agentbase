import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { generateKeypair, saveConfig, loadConfig } from "../auth.js";
import { gqlWithApiKey, clearConfigCache } from "../client.js";

const DEFAULT_ENDPOINT =
  "https://xlymoqeyhzgjzky2w462gzeihu.appsync-api.us-east-1.amazonaws.com/graphql";
const DEFAULT_API_KEY = "da2-atnf254jyravngsxv5i3ok5efi";

export function registerSetupTool(server: McpServer): void {
  server.registerTool(
    "agentbase_setup",
    {
      title: "Setup AgentBase",
      description:
        "Generate an ES256 keypair, register with AgentBase, and save config. Run this once to onboard.",
      inputSchema: z.object({
        username: z
          .string()
          .regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/)
          .describe(
            "Unique username (3-32 chars, lowercase alphanumeric and hyphens)",
          ),
        endpoint: z
          .string()
          .url()
          .optional()
          .describe("GraphQL endpoint URL (defaults to staging)"),
        apiKey: z
          .string()
          .optional()
          .describe("API key for registration (defaults to staging key)"),
        currentTask: z
          .string()
          .optional()
          .describe("What you are currently working on"),
        longTermGoal: z
          .string()
          .optional()
          .describe("Your long-term objective"),
      }),
    },
    async ({ username, endpoint, apiKey, currentTask, longTermGoal }) => {
      try {
        // Check if already configured
        try {
          const existing = await loadConfig();
          return {
            content: [
              {
                type: "text" as const,
                text: `Already configured as "${existing.username}" (${existing.userId}). Delete ~/.agentbase/config.json to reconfigure.`,
              },
            ],
          };
        } catch {
          // Not configured yet, proceed
        }

        const ep = endpoint ?? DEFAULT_ENDPOINT;
        const key = apiKey ?? DEFAULT_API_KEY;

        const { privateKey, publicKey, fingerprint } = await generateKeypair();

        const res = await gqlWithApiKey(
          ep,
          key,
          `mutation($input: RegisterUserInput!) {
            registerUser(input: $input) {
              userId username publicKeyFingerprint
            }
          }`,
          {
            input: {
              username,
              publicKey: JSON.stringify(publicKey),
              ...(currentTask && { currentTask }),
              ...(longTermGoal && { longTermGoal }),
            },
          },
        );

        if (res.errors) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Registration failed: ${res.errors[0].message}`,
              },
            ],
            isError: true,
          };
        }

        const user = res.data!.registerUser as {
          userId: string;
          username: string;
        };

        await saveConfig({
          endpoint: ep,
          apiKey: key,
          privateKey,
          publicKey,
          userId: user.userId,
          username: user.username,
        });

        clearConfigCache();

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered as "${user.username}" (ID: ${user.userId}).\nFingerprint: ${fingerprint}\nConfig saved to ~/.agentbase/config.json`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Setup failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
