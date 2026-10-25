import "dotenv/config";

import { createRedisConnection } from "../../shared/src/redis/redis_connection"
import { EmailDeliveryService } from "./services/email_delivery_service";
import { Worker } from "bullmq";
import { NodemailerEmailSender } from "../../shared/src/email/nodemailer_email_sender";
import { prisma } from "../../lib/prisma"
import { QUEUE_NAMES } from "../../shared/src/queue/queue_names"
import { loadWorkerConfig } from "./config/worker_config";
import { EmailDeliveryRepository } from "./repositories/email_delivery_repository";
import { EmailDeliveryProcessor } from "./processors/email_delivery_processor";
import type { EmailDeliveryJob } from "../../shared/src/queue/emaill_delivery_job";
import { createEmailQueue } from "../../shared/src/queue/email_queue";
import { requiredEnv } from "../../shared/src/utils/require.js";
import { RateLimiter } from "../../shared/src/redis/rate_limiter.js";
import { SlackService } from "../../shared/src/slack/slack_service.js";
import { OutboxPublisher } from "./services/outbox_pulisher.js";
import { runOutboxPublisher } from "./services/outbox_publisher_loop.js";
import { ElasticsearchService } from "../../shared/src/elasticsearch/elasticsearch_service.js";



async function main(): Promise<void> {

  const config = loadWorkerConfig();
  
  const esService = new ElasticsearchService();
  await esService.createIndexIfNotExists();

  const connRedis = createRedisConnection(config.redis);

  const emailQueue = createEmailQueue(connRedis);

  const counts = await emailQueue.getJobCounts(
  "waiting",
  "active",
  "delayed",
  "completed",
  "failed",
);



console.log("Email queue counts:", counts);

const waitingJobs = await emailQueue.getJobs(
  ["waiting", "delayed", "active"],
  0,
  20,
);

// console.log(
//   "Email queue jobs:",
//   waitingJobs.map((job) => ({
//     id: job.id,
//     name: job.name,
//     data: job.data,
//     delay: job.delay,
//     timestamp: job.timestamp,
//     processedOn: job.processedOn,
//     failedReason: job.failedReason,
//   })),
// );

for (const job of waitingJobs) {
  console.log({
    id: job.id,
    deliveryId: job.data.deliveryId,
    state: await job.getState(),
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    delay: job.delay,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
  });
}

console.log(Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER));
  const rateLimiter = new RateLimiter(
  connRedis,
  Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 200),
  Number(process.env.MIN_EMAIL_DELAY_MS ?? 2000),
);

  

  const emailSender = new NodemailerEmailSender({
    host: requiredEnv("SMTP_HOST"),
    port: Number(requiredEnv("SMTP_PORT")),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? ""
  });

  await connRedis.ping();

  await emailSender.verifyConnection();

  const slackService = new SlackService(prisma, connRedis);

  const deliveryRepository = new EmailDeliveryRepository();
  const deliveryService = new EmailDeliveryService(deliveryRepository, emailSender, rateLimiter, slackService) ;
  const deliveryProcessor = new EmailDeliveryProcessor(deliveryService);

  const outboxPublisher = new OutboxPublisher(
  prisma,
  emailQueue,
  esService,
);

const publisherAbort = new AbortController();

const publisherTask = runOutboxPublisher(
  outboxPublisher,
  Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000),
  publisherAbort.signal,
);

const staleAfterMs = Number(
  process.env.DELIVERY_STALE_AFTER_MS ?? 900_000,
);

const recoverStaleDeliveries = async () => {
  const recovered = await deliveryRepository.recoverStaleProcessing(
    new Date(Date.now() - staleAfterMs),
  );

  if (recovered > 0) {
    console.warn(`Recovered ${recovered} stale deliveries`);
  }
};

await recoverStaleDeliveries();

const recoveryTimer = setInterval(() => {
  void recoverStaleDeliveries().catch((error) => {
    console.error("Stale delivery recovery failed", error);
  });
}, 60_000);


  const worker = new Worker<EmailDeliveryJob>(
    QUEUE_NAMES.EMAIL_DELIVERY,
    (job, token) => deliveryProcessor.process(job, token),
    {
      connection: connRedis,
      concurrency: config.concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Email delivery job completed: ${job.id}`)
  })

  worker.on("failed", (job, error) => {
    console.error(
      `Email delivery job failed: ${job?.id ?? "unknown"}`,
      error.message,
    );
  });

  worker.on("error", (error) => {
    console.error("BullMQ worker error:", error.message);
  });

  console.log(
    `Email worker started. Queue=${QUEUE_NAMES.EMAIL_DELIVERY}, concurrency=${config.concurrency}`,
  );


  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {

    if(shuttingDown) return;

    shuttingDown = true;

     try {
      clearInterval(recoveryTimer);
      publisherAbort.abort();
      await publisherTask;
      await worker.close();
      await emailQueue.close();
      await connRedis.quit();
      await prisma.$disconnect();

      console.log("Worker shut down gracefully.");
    } catch (error) {
      console.error("Worker shutdown failed:", error);
      process.exitCode = 1;
    }


  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));


}

main().catch(async (error: unknown) => {
  console.error("Failed to start email worker:", error);
  prisma.$disconnect();
  process.exit(1);
})