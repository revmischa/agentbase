import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndStoreJti } from "../replay.js";

// Mock ElectroDB entity
const mockCreate = vi.fn();
vi.mock("../../entities/jti.js", () => ({
  JtiCacheEntity: {
    create: (...args: unknown[]) => ({
      go: () => mockCreate(...args),
    }),
  },
}));

describe("checkAndStoreJti", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("stores a new JTI successfully", async () => {
    mockCreate.mockResolvedValue({ data: {} });
    const exp = Math.floor(Date.now() / 1000) + 30;

    await expect(checkAndStoreJti("unique-jti-1", exp)).resolves.toBeUndefined();

    expect(mockCreate).toHaveBeenCalledWith({
      jti: "unique-jti-1",
      exp,
      ttl: exp + 300,
    });
  });

  it("throws REPLAY_DETECTED on duplicate JTI", async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error("ConditionalCheckFailed"), {
        code: "ConditionalCheckFailedException",
      }),
    );
    const exp = Math.floor(Date.now() / 1000) + 30;

    await expect(checkAndStoreJti("duplicate-jti", exp)).rejects.toThrow(
      "Token has already been used",
    );
  });

  it("re-throws non-replay errors", async () => {
    mockCreate.mockRejectedValue(new Error("DynamoDB timeout"));
    const exp = Math.floor(Date.now() / 1000) + 30;

    await expect(checkAndStoreJti("some-jti", exp)).rejects.toThrow(
      "DynamoDB timeout",
    );
  });
});
