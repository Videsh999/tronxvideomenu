import { randomUUID } from "node:crypto";
import { AiUsageEventModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";

const WINDOW_MS = 60 * 60 * 1000;
const PER_ACCOUNT_LIMIT = 60;
const PER_ORG_LIMIT = 300;

export async function assertAiRateLimit(params: {
  accountId: string;
  restaurantId: string;
  organizationId?: string;
}): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec: number }> {
  await connectToDatabase();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const accountCount = await AiUsageEventModel.countDocuments({
    accountId: params.accountId,
    createdAt: { $gte: since },
  });
  if (accountCount >= PER_ACCOUNT_LIMIT) {
    return { ok: false, error: "AI rate limit exceeded for this account.", retryAfterSec: 3600 };
  }
  if (params.organizationId) {
    const orgCount = await AiUsageEventModel.countDocuments({
      organizationId: params.organizationId,
      createdAt: { $gte: since },
    });
    if (orgCount >= PER_ORG_LIMIT) {
      return { ok: false, error: "AI rate limit exceeded for this organization.", retryAfterSec: 3600 };
    }
  }
  return { ok: true };
}

export async function recordAiUsage(params: {
  restaurantId: string;
  organizationId?: string;
  accountId: string;
  route: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
}) {
  await connectToDatabase();
  await AiUsageEventModel.create({
    id: `aiu-${randomUUID()}`,
    ...params,
    createdAt: new Date().toISOString(),
  });
}
