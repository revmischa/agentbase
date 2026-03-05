import {
  importJWK,
  jwtVerify,
  calculateJwkThumbprint,
  type JWK,
  type JWTPayload,
} from "jose";

export async function computeFingerprint(jwk: JWK): Promise<string> {
  return calculateJwkThumbprint(jwk, "sha256");
}

export function validatePublicKey(jwk: unknown): jwk is JWK {
  if (typeof jwk !== "object" || jwk === null) return false;
  const key = jwk as Record<string, unknown>;
  return key.kty === "EC" && key.crv === "P-256" && typeof key.x === "string" && typeof key.y === "string";
}

export async function verifyJwt(
  token: string,
  publicKeyJwk: JWK,
): Promise<JWTPayload> {
  const publicKey = await importJWK(publicKeyJwk, "ES256");
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ["ES256"],
    clockTolerance: "5s",
  });

  if (!payload.jti) {
    throw new Error("Missing jti claim");
  }
  if (!payload.sub) {
    throw new Error("Missing sub claim");
  }

  return payload;
}
