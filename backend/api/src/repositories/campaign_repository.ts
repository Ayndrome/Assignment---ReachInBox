
// import { randomUUID } from "node:crypto";
// import type { PrismaClient } from "../../../generated/prisma/client.js";
// import type { CreateCampaignInput } from "../validation/campaign_schema.js";

// export class CampaignRepository {
//   constructor(private readonly prisma: PrismaClient) {}

//   async createScheduledCampaign(
//     userId: string,
//     input: CreateCampaignInput,
//   ) {
//     return this.prisma.$transaction(async (tx) => {
//       // Enforce ownership and ensure the sender can be used.
//       const sender = await tx.senders.findFirst({
//         where: {
//           id: input.senderId,
//           user_id: userId,
//           is_active: true,
//         },
//         select: { id: true },
//       });

//       if (!sender) {
//         throw new Error("SENDER_NOT_FOUND_OR_INACTIVE");
//       }

//       const startAt = new Date(input.startAt);

//       // Enforce both the requested delay and the hourly sending limit.
//       // This is a conservative fixed interval between deliveries.
//       const hourlyInterval = Math.ceil(3600 / input.hourlyLimit);
//       const intervalSeconds = Math.max(
//         input.delaySeconds,
//         hourlyInterval,
//       );

//       const campaign = await tx.campaigns.create({
//     data: {
//       user_id: userId,
//       sender_id: sender.id,
//       ...(input.name !== undefined && { name: input.name }),
//       subject: input.subject,
//       body_text: input.bodyText,
//       ...(input.bodyHtml !== undefined && {
//         body_html: input.bodyHtml,
//       }),
//       start_at: startAt,
//       delay_seconds: input.delaySeconds,
//       hourly_limit: input.hourlyLimit,
//       status: "SCHEDULED",
//     },
//             select: {
//           id: true,
//           name: true,
//           subject: true,
//           start_at: true,
//           status: true,
//           created_at: true,
//         },
//       });

//       const deliveries = input.recipients.map((recipient, index) => ({
//         id: randomUUID(),
//         campaign_id: campaign.id,
//         recipient_email: recipient,
//         scheduled_at: new Date(
//           startAt.getTime() + index * intervalSeconds * 1000,
//         ),
//         status: "SCHEDULED" as const,
//       }));

//       // Explicit IDs let us create outbox records in the same transaction.
//       await tx.emailDeliveries.createMany({
//         data: deliveries,
//       });

//       await tx.outboxEvents.createMany({
//         data: deliveries.map((delivery) => ({
//           event_type: "EMAIL_DELIVERY_REQUESTED",
//           aggregate_id: delivery.id,
//           payload: { deliveryId: delivery.id },
//         })),
//       });

//       return {
//         ...campaign,
//         recipientCount: deliveries.length,
//       };
//     });
//   }
// }



import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { CreateCampaignInput } from "../validation/campaign_schema.js";

export class CampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Safely transforms an un-zoned HTML datetime-local string 
   * into a standardized UTC Date object anchored in Indian Standard Time (IST).
   */
  private parseIndianTimeToUTC(localIsoString: string): Date {
    // 1. Create a modern formatter explicitly locked to the Indian zone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });

    // 2. Read the baseline text assuming UTC to extract clock adjustments
    const baseDate = new Date(`${localIsoString}Z`);
    const parts = formatter.formatToParts(baseDate);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    // 3. Reconstruct what the runtime engine thought the target local date was
    const conceptualDate = new Date(
      `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}.000Z`
    );
    
    // 4. Calculate the real absolute offset value dynamically and yield a clean UTC Date object
    const calculatedOffset = baseDate.getTime() - conceptualDate.getTime();
    return new Date(baseDate.getTime() + calculatedOffset);
  }

  async createScheduledCampaign(userId: string, input: CreateCampaignInput) {
    return this.prisma.$transaction(async (tx) => {
      const sender = await tx.senders.findFirst({
        where: { id: input.senderId, user_id: userId, is_active: true },
        select: { id: true },
      });

      if (!sender) {
        throw new Error("SENDER_NOT_FOUND_OR_INACTIVE");
      }

      // Convert local string context into a pure UTC date safely
      const startAt = this.parseIndianTimeToUTC(input.startAt);

      // Prevent historical context bugs (Enforce future schedules only)
      if (startAt.getTime() < Date.now()) {
        throw new Error("SCHEDULED_TIME_MUST_BE_IN_FUTURE");
      }

      const hourlyInterval = Math.ceil(3600 / input.hourlyLimit);
      const intervalSeconds = Math.max(input.delaySeconds, hourlyInterval);

      // Everything saved down to campaigns and deliveries will remain consistently in UTC
      const campaign = await tx.campaigns.create({
        data: {
          user_id: userId,
          sender_id: sender.id,
          ...(input.name !== undefined && { name: input.name }),
          subject: input.subject,
          body_text: input.bodyText,
          ...(input.bodyHtml !== undefined && { body_html: input.bodyHtml }),
          start_at: startAt, 
          delay_seconds: input.delaySeconds,
          hourly_limit: input.hourlyLimit,
          status: "SCHEDULED",
        },
        select: { id: true, name: true, subject: true, start_at: true, status: true, created_at: true },
      });

      const deliveries = input.recipients.map((recipient, index) => ({
        id: randomUUID(),
        campaign_id: campaign.id,
        recipient_email: recipient,
        scheduled_at: new Date(startAt.getTime() + index * intervalSeconds * 1000),
        status: "SCHEDULED" as const,
      }));

      await tx.emailDeliveries.createMany({ data: deliveries });

      

      await tx.outboxEvents.createMany({
        data: [
          ...deliveries.map((delivery) => ({
            event_type: "EMAIL_DELIVERY_REQUESTED",
            aggregate_id: delivery.id,
            payload: { deliveryId: delivery.id },
          })),
          ...deliveries.map((delivery) => ({
            event_type: "EMAIL_INDEX_REQUESTED",
            aggregate_id: delivery.id,
            payload: { deliveryId: delivery.id },
          })),
        ],
      });

      return { ...campaign, recipientCount: deliveries.length };
    });
  }
}
