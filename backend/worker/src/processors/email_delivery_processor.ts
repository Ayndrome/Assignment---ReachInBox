import {
  DelayedError,
  UnrecoverableError,
  type Job,
} from "bullmq";

import type { EmailDeliveryJob } from "../../../shared/src/queue/emaill_delivery_job";
import { PermanentDeliveryError } from "../errors/permanent_delivery_error.js";
import { EmailDeliveryService } from "../services/email_delivery_service.js";

export class EmailDeliveryProcessor {
  constructor(
    private readonly deliveryService: EmailDeliveryService,
  ) {}

  async process(
    job: Job<EmailDeliveryJob>,
    token?: string,
  ): Promise<void> {
    const configuredAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= configuredAttempts;

    try {
      const result = await this.deliveryService.processDelivery(
        job.data.deliveryId,
        isFinalAttempt,
      );

      if (result.kind === "DELAY_UNTIL") {
        if (!token) {
          throw new Error("Missing BullMQ lock token for delayed job");
        }

        await job.moveToDelayed(
    Math.max(Date.now() + 100, result.scheduledAt),
    token,
  );
        throw new DelayedError();
      }
    } catch (error: unknown) {
      if (error instanceof PermanentDeliveryError) {
        throw new UnrecoverableError(error.message);
      }

      throw error;
    }
  }
}