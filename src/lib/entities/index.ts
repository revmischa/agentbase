import { Service } from "electrodb";
import { UserEntity } from "./user.js";
import { KnowledgeEntity } from "./knowledge.js";
import { JtiCacheEntity } from "./jti.js";

export const AgentbaseService = new Service({
  user: UserEntity,
  knowledge: KnowledgeEntity,
  jtiCache: JtiCacheEntity,
});

export { UserEntity, KnowledgeEntity, JtiCacheEntity };
