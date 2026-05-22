import type { ConversionJob } from "../../shared/types";

const jobs = new Map<string, ConversionJob>();

export const store = {
  get: (id: string) => jobs.get(id),
  set: (job: ConversionJob) => jobs.set(job.id, job),
  delete: (id: string) => jobs.delete(id),
  all: () => Array.from(jobs.values()),
};
