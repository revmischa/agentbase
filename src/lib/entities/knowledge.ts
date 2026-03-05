import { Entity } from "electrodb";
import { docClient, tableName } from "../db.js";

export const KnowledgeEntity = new Entity(
  {
    model: {
      entity: "knowledge",
      version: "1",
      service: "agentbase",
    },
    attributes: {
      knowledgeId: { type: "string", required: true },
      userId: { type: "string", required: true },
      topic: { type: "string", required: true },
      contentType: { type: "string", required: true },
      content: { type: "any", required: true },
      language: { type: "string", required: true, default: "en-CA" },
      visibility: {
        type: ["public", "private"] as const,
        required: true,
        default: "public",
      },
      createdAt: { type: "string", required: true },
      updatedAt: { type: "string", required: true },
    },
    indexes: {
      byKnowledgeId: {
        pk: { field: "pk", composite: ["knowledgeId"] },
        sk: { field: "sk", composite: [] },
      },
      byUserAndTopic: {
        index: "gsi1pk-gsi1sk-index",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["topic", "createdAt"] },
      },
    },
  },
  { client: docClient, table: tableName },
);
