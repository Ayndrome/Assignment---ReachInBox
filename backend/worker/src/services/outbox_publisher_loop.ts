import { OutboxPublisher } from "./outbox_pulisher";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runOutboxPublisher(
  publisher: OutboxPublisher,
  pollIntervalMs: number,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    try {
      const published = await publisher.publishBatch(50);

      if (published > 0) {
        continue;
      }
    } catch (error) {
      console.error("Outbox publishing iteration failed", error);
    }

    try {
      await sleep(pollIntervalMs);
    } catch {
      
    }
  }
}