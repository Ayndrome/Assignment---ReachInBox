import "dotenv/config";
import { Redis } from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

connection.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

async function main() {
  await connection.ping();
  console.log("Worker infrastructure ready: Redis connected");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

