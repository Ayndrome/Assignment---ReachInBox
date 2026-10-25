import type { Queue, Job } from "bullmq";

import type { EmailDeliveryJob } from "../queue/emaill_delivery_job";

export class EmailQueueProducer {
  constructor(
    private readonly queue: Queue<EmailDeliveryJob>,
  ) {}

  async enqueue(
    deliveryId: string,
    scheduledAt: Date,
  ): Promise<Job<EmailDeliveryJob>> {
    if (!deliveryId.trim()) {
      throw new Error("Delivery ID is required");
    }

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error("Invalid scheduled delivery date");
    }

    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    return this.queue.add(
      "deliver-email",
      { deliveryId },
      {
        jobId: `delivery-${deliveryId}`,
        delay,
      },
    );
  }
}