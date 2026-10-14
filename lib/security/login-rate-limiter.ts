import { connectToDatabase } from "@/lib/db/mongodb";
import { LoginAttemptModel } from "@/lib/db/rate-limit-model";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

export class LoginRateLimiter {
  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60 * 1000, // 15 minutes
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    try {
      await connectToDatabase();
      const record = await LoginAttemptModel.findOne({ key }).lean();
      if (!record) {
        return { allowed: true, remaining: this.maxAttempts };
      }

      if (record.attempts >= this.maxAttempts) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, this.maxAttempts - record.attempts),
      };
    } catch {
      // In case of database error, fail safely so legitimate admins aren't hard-blocked,
      // but log for operational awareness.
      return { allowed: true, remaining: 1 };
    }
  }

  async recordFailure(key: string): Promise<void> {
    try {
      await connectToDatabase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.windowMs);

      await LoginAttemptModel.findOneAndUpdate(
        { key },
        {
          $inc: { attempts: 1 },
          $set: { lastAttemptAt: now, expiresAt },
        },
        { upsert: true, new: true },
      );
    } catch {
      // Ignore DB errors during attempt logging
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await connectToDatabase();
      await LoginAttemptModel.deleteOne({ key });
    } catch {
      // Ignore DB errors during reset
    }
  }
}

export const loginRateLimiter = new LoginRateLimiter();
