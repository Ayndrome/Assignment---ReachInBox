import "dotenv/config";

export interface WorkerConfig {
  redis: {
    host: string;
    port: number;
  };
  concurrency: number;
}

function readPositiveInteger(
  name: string,
  defaultValue: number,
): number {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    redis: {
      host: process.env.REDIS_HOST ?? "127.0.0.1",
      port: readPositiveInteger("REDIS_PORT", 6379),
    },
    concurrency: readPositiveInteger(
      "WORKER_CONCURRENCY",
      5,
    ),
  };
}