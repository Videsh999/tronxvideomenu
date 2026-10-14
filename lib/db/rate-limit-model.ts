import mongoose, { Schema } from "mongoose";

export type LoginAttempt = {
  key: string;
  attempts: number;
  lastAttemptAt: Date;
  expiresAt: Date;
};

const loginAttemptSchema = new Schema<LoginAttempt>(
  {
    key: { type: String, required: true, unique: true, index: true },
    attempts: { type: Number, required: true, default: 1 },
    lastAttemptAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false, collection: "loginAttempts" },
);

export const LoginAttemptModel =
  mongoose.models.LoginAttempt ??
  mongoose.model<LoginAttempt>("LoginAttempt", loginAttemptSchema);
