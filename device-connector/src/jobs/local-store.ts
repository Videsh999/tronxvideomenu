import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type LocalJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN"
  | "MANUAL_REVIEW";

export type LocalJob = {
  id: string;
  deviceId: string;
  jobType: string;
  payloadHash: string;
  status: LocalJobStatus;
  attemptCount: number;
  updatedAt: string;
  errorMessage?: string;
};

type StoreShape = { jobs: Record<string, LocalJob> };

function pathFor(dataDir: string) {
  return join(dataDir, "local-jobs.json");
}

function read(dataDir: string): StoreShape {
  const p = pathFor(dataDir);
  if (!existsSync(p)) return { jobs: {} };
  return JSON.parse(readFileSync(p, "utf8")) as StoreShape;
}

function write(dataDir: string, store: StoreShape) {
  mkdirSync(dataDir, { recursive: true });
  try {
    writeFileSync(pathFor(dataDir), JSON.stringify(store, null, 2), { mode: 0o600 });
  } catch (cause) {
    const err = cause as NodeJS.ErrnoException;
    if (err.code === "ENOSPC") {
      throw new Error("Local job store disk full — cannot persist job state");
    }
    throw cause;
  }
}

export function upsertLocalJob(dataDir: string, job: LocalJob): LocalJob {
  const store = read(dataDir);
  const existing = store.jobs[job.id];
  if (existing && existing.status === "COMPLETED") return existing;
  store.jobs[job.id] = job;
  write(dataDir, store);
  return job;
}

export function getLocalJob(dataDir: string, id: string): LocalJob | null {
  return read(dataDir).jobs[id] ?? null;
}

export function listReviewJobs(dataDir: string): LocalJob[] {
  return Object.values(read(dataDir).jobs).filter(
    (j) => j.status === "UNKNOWN" || j.status === "MANUAL_REVIEW",
  );
}
