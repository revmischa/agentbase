import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult } from "aws-lambda";
import { logger } from "../lib/powertools.js";
import { UserEntity } from "../lib/entities/user.js";
import { verifyJwt } from "../lib/auth/keys.js";
import { checkAndStoreJti } from "../lib/auth/replay.js";
import type { JWK } from "jose";

export async function handler(
  event: AppSyncAuthorizerEvent,
): Promise<AppSyncAuthorizerResult<Record<string, string>>> {
  const token = event.authorizationToken?.replace(/^Bearer\s+/i, "");

  if (!token) {
    logger.warn("Missing authorization token");
    return deny();
  }

  try {
    // Decode token header to get `sub` (fingerprint) without verifying
    const [headerB64] = token.split(".");
    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString(),
    );

    // Actually we need sub from payload, not header
    const [, payloadB64] = token.split(".");
    const unverifiedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString(),
    );
    const fingerprint = unverifiedPayload.sub as string;

    if (!fingerprint) {
      logger.warn("Missing sub claim in token");
      return deny();
    }

    // Look up user by fingerprint
    const { data: users } = await UserEntity.query
      .byFingerprint({ publicKeyFingerprint: fingerprint })
      .go();

    if (users.length === 0) {
      logger.warn("No user found for fingerprint", { fingerprint });
      return deny();
    }

    const user = users[0];

    // Verify JWT with stored public key
    const payload = await verifyJwt(token, user.publicKey as JWK);

    // Check replay
    await checkAndStoreJti(payload.jti!, payload.exp!);

    logger.info("Auth success", {
      userId: user.userId,
      username: user.username,
    });

    return {
      isAuthorized: true,
      resolverContext: {
        userId: user.userId,
        username: user.username,
      },
      ttlOverride: 0,
    };
  } catch (err) {
    logger.error("Auth failed", { error: err });
    return deny();
  }
}

function deny(): AppSyncAuthorizerResult<Record<string, string>> {
  return {
    isAuthorized: false,
    resolverContext: {},
    ttlOverride: 0,
  };
}
