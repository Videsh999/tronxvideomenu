import mongoose, { Schema } from "mongoose";

export type TranslationCacheEntry = {
  key: string;
  targetLanguage: string;
  source: string;
  text: string;
  provider: string;
  createdAt: Date;
};

const translationCacheSchema = new Schema<TranslationCacheEntry>(
  {
    key: { type: String, required: true, unique: true, index: true },
    targetLanguage: { type: String, required: true },
    source: { type: String, required: true },
    text: { type: String, required: true },
    provider: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false, collection: "translationCache" },
);

export const TranslationCacheModel =
  mongoose.models.TranslationCache ??
  mongoose.model<TranslationCacheEntry>("TranslationCache", translationCacheSchema);
