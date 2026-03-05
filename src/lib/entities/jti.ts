import { Entity } from "electrodb";
import { docClient, tableName } from "../db.js";

export const JtiCacheEntity = new Entity(
  {
    model: {
      entity: "jticache",
      version: "1",
      service: "agentbase",
    },
    attributes: {
      jti: { type: "string", required: true },
      exp: { type: "number", required: true },
      ttl: { type: "number", required: true },
    },
    indexes: {
      byJti: {
        pk: { field: "pk", composite: ["jti"] },
        sk: { field: "sk", composite: [] },
      },
    },
  },
  { client: docClient, table: tableName },
);
