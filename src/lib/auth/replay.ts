import { JtiCacheEntity } from "../entities/jti.js";
import { AppError } from "../errors.js";

export async function checkAndStoreJti(
  jti: string,
  exp: number,
): Promise<void> {
  // TTL = exp + 300 seconds (5 min buffer for clock skew cleanup)
  const ttl = exp + 300;

  try {
    await JtiCacheEntity.create({
      jti,
      exp,
      ttl,
    }).go({
      // ElectroDB create uses attribute_not_exists by default
      // which prevents overwriting existing items
    });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (
      error.code === "ConditionalCheckFailedException" ||
      error.message?.includes("ConditionalCheckFailed")
    ) {
      throw new AppError("REPLAY_DETECTED", "Token has already been used");
    }
    throw err;
  }
}
