import type { Queue } from "bullmq";
import type { PrismaClient } from "../../../generated/prisma/client";
import type { EmailDeliveryJob } from "../../../shared/src/queue/emaill_delivery_job";
import { ElasticsearchService } from "../../../shared/src/elasticsearch/elasticsearch_service.js";

interface OutboxPayload {
  deliveryId: string;
}

export class OutboxPublisher {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: Queue<EmailDeliveryJob>,
    private readonly esService: ElasticsearchService,
    private readonly maxAttempts = 10,
  ) {}

  

  async publishBatch(batchSize = 50): Promise<number> {
    await this.recoverStaleClaims();
    
    // Process indexing events
    await this.publishIndexingEvents(batchSize);

    const delivery = await this.prisma.emailDeliveries.findUnique({
  where: {
    id: "d08a1907-7273-403d-a205-e772316045ee",
  },
  select: {
    id: true,
    scheduled_at: true,
    status: true,
  },
});

if (delivery) {
  console.log("Scheduling diagnostic:", {
    scheduledAtISO: delivery.scheduled_at.toISOString(),
    scheduledAtLocal: delivery.scheduled_at.toString(),
    nowISO: new Date().toISOString(),
    calculatedDelayMs: Math.max(
      0,
      delivery.scheduled_at.getTime() - Date.now(),
    ),
    status: delivery.status,
  });
}
    // console.log("Yahan chala");
    const events = await this.prisma.outboxEvents.findMany({
      where: {
        status: "PENDING",
        available_at: { lte: new Date() },
        event_type: "EMAIL_DELIVERY_REQUESTED",
      },
      orderBy: { created_at: "asc" },
      take: batchSize,
    });

//     const allEvents = await this.prisma.outboxEvents.findMany({
//   select: {
//     id: true,
//     status: true,
//     event_type: true,
//     available_at: true,
//     published_at: true,
//     locked_at: true,
//   },
//   orderBy: { created_at: "desc" },
//   take: 10,
// });

// console.log("Recent outbox events:", allEvents);
//     // console.log(JSON.stringify(events));
    let published = 0;
    
    for (const event of events) {
      console.log("Yahan chala");
      const claimed = await this.prisma.outboxEvents.updateMany({
        where: {
          id: event.id,
          status: "PENDING",
          available_at: { lte: new Date() },
        },
        data: {
          status: "PUBLISHING",
          locked_at: new Date(),
        },
      });

      
      if (claimed.count !== 1) continue;

      try {
        const payload = event.payload as unknown as Partial<OutboxPayload>;

        if (
          typeof payload.deliveryId !== "string" ||
          !payload.deliveryId.trim()
        ) {
          await this.failPermanently(event.id, "Missing deliveryId");
          continue;
        }

        const delivery = await this.prisma.emailDeliveries.findUnique({
          where: { id: payload.deliveryId },
          select: { id: true, scheduled_at: true },
        });



        if (!delivery) {
          await this.failPermanently(
            event.id,
            `Delivery ${payload.deliveryId} does not exist`,
          );
          continue;
        }

                console.log({
  rawScheduledAt: delivery?.scheduled_at,
  scheduledAtISO: delivery?.scheduled_at.toISOString(),
  scheduledAtLocal: delivery?.scheduled_at.toString(),
  nowISO: new Date().toISOString(),
  calculatedDelayMs: Math.max(
    0,
    delivery!.scheduled_at.getTime() - Date.now(),
  ),
});

        const delay = Math.max(
          0,
          delivery.scheduled_at.getTime() - Date.now(),
        );

    
        await this.queue.add(
          "deliver-email",
          { deliveryId: delivery.id },
          {
            jobId: `outbox-${event.id}`,
            delay,
          },
        );

       

        await this.prisma.outboxEvents.updateMany({
          where: { id: event.id, status: "PUBLISHING" },
          data: {
            status: "PUBLISHED",
            published_at: new Date(),
            locked_at: null,
            last_error: null,
          },
        });

        published++;
      } catch (error) {
        await this.recordFailure(
          event.id,
          error instanceof Error ? error.message : "Unknown publishing error",
        );
      }
    }

    return published;
  }

  private async publishIndexingEvents(batchSize: number): Promise<void> {
    const events = await this.prisma.outboxEvents.findMany({
      where: {
        status: "PENDING",
        available_at: { lte: new Date() },
        event_type: "EMAIL_INDEX_REQUESTED",
      },
      orderBy: { created_at: "asc" },
      take: batchSize,
    });

    for (const event of events) {
      const claimed = await this.prisma.outboxEvents.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: { status: "PUBLISHING", locked_at: new Date() },
      });

      if (claimed.count !== 1) continue;

      try {
        const payload = event.payload as unknown as Partial<OutboxPayload>;
        if (!payload.deliveryId) {
          await this.failPermanently(event.id, "Missing deliveryId");
          continue;
        }

        const delivery = await this.prisma.emailDeliveries.findUnique({
          where: { id: payload.deliveryId },
          include: { campaign: true },
        });

        if (!delivery) {
          await this.failPermanently(event.id, `Delivery ${payload.deliveryId} not found`);
          continue;
        }

        await this.esService.indexDelivery({
          id: delivery.id,
          campaign_id: delivery.campaign_id,
          user_id: delivery.campaign.user_id,
          sender_id: delivery.campaign.sender_id,
          recipient_email: delivery.recipient_email,
          subject: delivery.campaign.subject,
          status: delivery.status,
          scheduled_at: delivery.scheduled_at.toISOString(),
          sent_at: delivery.sent_at?.toISOString() ?? null,
          created_at: delivery.created_at.toISOString(),
        });

        await this.prisma.outboxEvents.updateMany({
          where: { id: event.id, status: "PUBLISHING" },
          data: {
            status: "PUBLISHED",
            published_at: new Date(),
            locked_at: null,
            last_error: null,
          },
        });
      } catch (error) {
        await this.recordFailure(
          event.id,
          error instanceof Error ? error.message : "Unknown indexing error",
        );
      }
    }
  }

  private async recoverStaleClaims(): Promise<void> {
    const staleBefore = new Date(Date.now() - 120_000);

    await this.prisma.outboxEvents.updateMany({
      where: {
        status: "PUBLISHING",
        locked_at: { lt: staleBefore },
      },
      data: {
        status: "PENDING",
        locked_at: null,
        available_at: new Date(),
        last_error: "Recovered stale publishing claim",
      },
    });
  }

  private async failPermanently(
    eventId: string,
    message: string,
  ): Promise<void> {
    await this.prisma.outboxEvents.updateMany({
      where: { id: eventId, status: "PUBLISHING" },
      data: {
        status: "FAILED",
        locked_at: null,
        last_error: message.slice(0, 5000),
      },
    });
  }

  private async recordFailure(
    eventId: string,
    message: string,
  ): Promise<void> {
    const event = await this.prisma.outboxEvents.findUnique({
      where: { id: eventId },
      select: { attempts: true },
    });

    if (!event) return;

    const attempts = event.attempts + 1;
    const terminal = attempts >= this.maxAttempts;
    const delayMs = Math.min(
      60_000,
      1_000 * 2 ** Math.min(attempts - 1, 6),
    );

    await this.prisma.outboxEvents.updateMany({
      where: { id: eventId, status: "PUBLISHING" },
      data: {
        attempts,
        status: terminal ? "FAILED" : "PENDING",
        available_at: new Date(Date.now() + delayMs),
        locked_at: null,
        last_error: message.slice(0, 5000),
      },
    });
  }
}