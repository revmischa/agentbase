import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  type JWK,
} from "jose";
import {
  computeFingerprint,
  validatePublicKey,
  verifyJwt,
} from "../keys.js";

async function createTestKeyPair() {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  return { publicJwk, privateJwk, publicKey, privateKey };
}

async function signTestJwt(
  privateKey: CryptoKey,
  fingerprint: string,
  overrides: Record<string, unknown> = {},
) {
  const builder = new SignJWT({})
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(fingerprint)
    .setIssuedAt()
    .setExpirationTime("30s")
    .setJti(crypto.randomUUID());

  return builder.sign(privateKey);
}

describe("computeFingerprint", () => {
  it("returns consistent fingerprint for same key", async () => {
    const { publicJwk } = await createTestKeyPair();
    const fp1 = await computeFingerprint(publicJwk);
    const fp2 = await computeFingerprint(publicJwk);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(10);
  });

  it("returns different fingerprints for different keys", async () => {
    const key1 = await createTestKeyPair();
    const key2 = await createTestKeyPair();
    const fp1 = await computeFingerprint(key1.publicJwk);
    const fp2 = await computeFingerprint(key2.publicJwk);
    expect(fp1).not.toBe(fp2);
  });
});

describe("validatePublicKey", () => {
  it("accepts valid EC P-256 JWK", async () => {
    const { publicJwk } = await createTestKeyPair();
    expect(validatePublicKey(publicJwk)).toBe(true);
  });

  it("rejects non-object", () => {
    expect(validatePublicKey("not-an-object")).toBe(false);
    expect(validatePublicKey(null)).toBe(false);
    expect(validatePublicKey(42)).toBe(false);
  });

  it("rejects wrong kty", () => {
    expect(validatePublicKey({ kty: "RSA", crv: "P-256", x: "a", y: "b" })).toBe(false);
  });

  it("rejects wrong crv", () => {
    expect(validatePublicKey({ kty: "EC", crv: "P-384", x: "a", y: "b" })).toBe(false);
  });

  it("rejects missing x or y", () => {
    expect(validatePublicKey({ kty: "EC", crv: "P-256", x: "a" })).toBe(false);
    expect(validatePublicKey({ kty: "EC", crv: "P-256", y: "b" })).toBe(false);
  });
});

describe("verifyJwt", () => {
  it("verifies a valid JWT", async () => {
    const { publicJwk, privateKey } = await createTestKeyPair();
    const fingerprint = await computeFingerprint(publicJwk);
    const token = await signTestJwt(privateKey, fingerprint);

    const payload = await verifyJwt(token, publicJwk);
    expect(payload.sub).toBe(fingerprint);
    expect(payload.jti).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it("rejects expired JWT", async () => {
    const { publicJwk, privateKey } = await createTestKeyPair();
    const fingerprint = await computeFingerprint(publicJwk);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setSubject(fingerprint)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .setJti(crypto.randomUUID())
      .sign(privateKey);

    await expect(verifyJwt(token, publicJwk)).rejects.toThrow();
  });

  it("rejects JWT signed with wrong key", async () => {
    const key1 = await createTestKeyPair();
    const key2 = await createTestKeyPair();
    const fingerprint = await computeFingerprint(key1.publicJwk);
    const token = await signTestJwt(key2.privateKey, fingerprint);

    await expect(verifyJwt(token, key1.publicJwk)).rejects.toThrow();
  });

  it("rejects JWT without jti", async () => {
    const { publicJwk, privateKey } = await createTestKeyPair();
    const fingerprint = await computeFingerprint(publicJwk);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setSubject(fingerprint)
      .setIssuedAt()
      .setExpirationTime("30s")
      .sign(privateKey);

    await expect(verifyJwt(token, publicJwk)).rejects.toThrow("Missing jti claim");
  });

  it("rejects JWT without sub", async () => {
    const { publicJwk, privateKey } = await createTestKeyPair();

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt()
      .setExpirationTime("30s")
      .setJti(crypto.randomUUID())
      .sign(privateKey);

    await expect(verifyJwt(token, publicJwk)).rejects.toThrow("Missing sub claim");
  });
});
