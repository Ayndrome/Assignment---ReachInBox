
import "dotenv/config";

import { createRedisConnection } from "../../../shared/src/redis/redis_connection";
import { createEmailQueue } from "../../../shared/src/queue/email_queue";
import { QUEUE_NAMES } from "../../../shared/src/queue/queue_names";
import { loadWorkerConfig } from "../config/worker_config";

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const connRedis = createRedisConnection(config.redis);
  const emailQueue = createEmailQueue(connRedis);

  try {
    await connRedis.ping();

    const before = await emailQueue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "completed",
      "failed",
    );

    console.log("Before cleanup:", before);
   
    // if (before && before.active > 0) {
    //   throw new Error(
    //     "Active jobs exist. Stop all workers before cleaning the queue.",
    //   );
    // }

    await emailQueue.obliterate({ force: true });

    const after = await emailQueue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "completed",
      "failed",
    );

    console.log("After cleanup:", after);
  } finally {
    await emailQueue.close();
    await connRedis.quit();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to clean email queue:", error);
  process.exitCode = 1;
});
