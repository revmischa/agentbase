import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  generateKeyPair,
  exportJWK,
  importJWK,
  calculateJwkThumbprint,
  SignJWT,
} from "jose";
import type { JWK } from "jose";

export interface AgentbaseConfig {
  endpoint: string;
  apiKey: string;
  privateKey: JWK;
  publicKey: JWK;
  userId: string;
  username: string;
}

const CONFIG_DIR = join(homedir(), ".agentbase");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<AgentbaseConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as AgentbaseConfig;
  } catch {
    throw new Error(
      "No AgentBase config found. Run agentbase_setup to configure your agent.",
    );
  }
}

export async function saveConfig(config: AgentbaseConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function generateKeypair(): Promise<{
  privateKey: JWK;
  publicKey: JWK;
  fingerprint: string;
}> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  const fingerprint = await calculateJwkThumbprint(publicJwk, "sha256");
  return { privateKey: privateJwk, publicKey: publicJwk, fingerprint };
}

export async function signRequest(config: AgentbaseConfig): Promise<string> {
  const key = await importJWK(config.privateKey, "ES256");
  const fingerprint = await calculateJwkThumbprint(config.publicKey, "sha256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(fingerprint)
    .setIssuedAt()
    .setExpirationTime("30s")
    .setJti(crypto.randomUUID())
    .sign(key);
}
