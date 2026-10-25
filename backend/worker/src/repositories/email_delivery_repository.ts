import { prisma } from "../../../lib/prisma";

export class EmailDeliveryRepository {

    async findByID(deliveryId: string){

        return prisma.emailDeliveries.findUnique({
            where: { id: deliveryId },
            include: {

                campaign: {
                    include: {

                        sender: true
                    },
                },
            },
        });

    }

   async claimForProcessing(deliveryId: string) {
    const now = new Date();

    const claim = await prisma.emailDeliveries.updateMany({
      where: {
        id: deliveryId,
        status: "SCHEDULED",
        scheduled_at: { lte: now },
      },
      data: {
        status: "PROCESSING",
        processing_started_at: now,
      },
    });

    if (claim.count !== 1) return null;

    await prisma.outboxEvents.create({
      data: {
        event_type: "EMAIL_INDEX_REQUESTED",
        aggregate_id: deliveryId,
        payload: { deliveryId },
      },
    });

    return prisma.emailDeliveries.findUniqueOrThrow({
      where: { id: deliveryId },
      include: { campaign: { include: { sender: true } } },
    });
  }

  async releaseRateLimitedClaim(deliveryId: string): Promise<void> {
    await prisma.emailDeliveries.updateMany({
      where: { id: deliveryId, status: "PROCESSING" },
      data: {
        status: "SCHEDULED",
        processing_started_at: null,
      },
    });
  }

  async createAttempt(deliveryId: string) {
    return prisma.$transaction(async (tx) => {
      const delivery = await tx.emailDeliveries.update({
        where: { id: deliveryId, status: "PROCESSING" },
        data: { attempt_count: { increment: 1 } },
        select: { id: true, attempt_count: true },
      });

      return tx.deliveryAttempts.create({
        data: {
          delivery_id: delivery.id,
          attempt_number: delivery.attempt_count,
          outcome: "PROCESSING",
        },
      });
    });
  }

  async markSent(
    deliveryId: string,
    attemptId: string,
    providerMessageId: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const result = await tx.emailDeliveries.updateMany({
        where: { id: deliveryId, status: "PROCESSING" },
        data: {
          status: "SENT",
          sent_at: new Date(),
          provider_message_id: providerMessageId,
          processing_started_at: null,
          last_error: null,
        },
      });

      if (result.count !== 1) {
        throw new Error("DELIVERY_STATE_CHANGED_BEFORE_SENT");
      }

      await tx.deliveryAttempts.update({
        where: { id: attemptId },
        data: {
          outcome: "SENT",
          finished_at: new Date(),
          provider_message_id: providerMessageId,
        },
      });

      await tx.outboxEvents.create({
        data: {
          event_type: "EMAIL_INDEX_REQUESTED",
          aggregate_id: deliveryId,
          payload: { deliveryId },
        },
      });
    });
  }

  async markRetryable(
    deliveryId: string,
    attemptId: string,
    errorMessage: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.emailDeliveries.update({
        where: { id: deliveryId },
        data: {
          status: "SCHEDULED",
          processing_started_at: null,
          last_error: errorMessage,
        },
      });

      await tx.deliveryAttempts.update({
        where: { id: attemptId },
        data: {
          outcome: "RETRYABLE",
          finished_at: new Date(),
          error_message: errorMessage,
        },
      });

      await tx.outboxEvents.create({
        data: {
          event_type: "EMAIL_INDEX_REQUESTED",
          aggregate_id: deliveryId,
          payload: { deliveryId },
        },
      });
    });
  }

  async markFailed(
    deliveryId: string,
    attemptId: string,
    errorMessage: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.emailDeliveries.update({
        where: { id: deliveryId },
        data: {
          status: "FAILED",
          processing_started_at: null,
          last_error: errorMessage,
        },
      });

      await tx.deliveryAttempts.update({
        where: { id: attemptId },
        data: {
          outcome: "FAILED",
          finished_at: new Date(),
          error_message: errorMessage,
        },
      });

      await tx.outboxEvents.create({
        data: {
          event_type: "EMAIL_INDEX_REQUESTED",
          aggregate_id: deliveryId,
          payload: { deliveryId },
        },
      });
    });
  }

  async recoverStaleProcessing(staleBefore: Date): Promise<number> {
  const staleDeliveries = await prisma.emailDeliveries.findMany({
    where: {
      status: "PROCESSING",
      processing_started_at: { lt: staleBefore },
    },
    select: { id: true },
  });

  let recovered = 0;

  for (const delivery of staleDeliveries) {
    const didRecover = await prisma.$transaction(async (tx) => {
      const result = await tx.emailDeliveries.updateMany({
        where: {
          id: delivery.id,
          status: "PROCESSING",
          processing_started_at: { lt: staleBefore },
        },
        data: {
          status: "SCHEDULED",
          processing_started_at: null,
        },
      });

      if (result.count !== 1) return false;

      await tx.outboxEvents.create({
        data: {
          event_type: "EMAIL_DELIVERY_REQUESTED",
          aggregate_id: delivery.id,
          payload: { deliveryId: delivery.id },
        },
      });

      return true;
    });

    if (didRecover) recovered++;
  }

  return recovered;
}


}