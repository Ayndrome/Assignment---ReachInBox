import type { Request, Response } from "express";
import { ElasticsearchService } from "../../../shared/src/elasticsearch/elasticsearch_service.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export class DeliveryController {
  constructor(
    private readonly esService: ElasticsearchService,
    private readonly prisma: PrismaClient
  ) {}

  search = async (req: Request, res: Response) => {
    const user = res.locals.user as { id: string } | undefined;
    if (!user?.id) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    const { q, status } = req.query;

    try {
      const results = await this.esService.searchDeliveries(
        user.id,
        q as string,
        status as string
      );
      res.json({ results });
    } catch (error) {
      console.error("Search failed", error);
      res.status(500).json({ error: "SEARCH_FAILED" });
    }
  };

  reindex = async (req: Request, res: Response) => {
    const user = res.locals.user as { id: string } | undefined;
    if (!user?.id) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    try {
      const deliveries = await this.prisma.emailDeliveries.findMany({
        where: { campaign: { user_id: user.id } },
        include: { campaign: true },
      });

      for (const delivery of deliveries) {
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
      }

      res.json({ status: "ok", count: deliveries.length });
    } catch (error) {
      console.error("Reindex failed", error);
      res.status(500).json({ error: "REINDEX_FAILED" });
    }
  };
}
