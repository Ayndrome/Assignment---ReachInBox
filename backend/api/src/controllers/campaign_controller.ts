import type { Request, Response } from "express";
import { createCampaignSchema } from "../validation/campaign_schema";
import { CampaignService } from "../service/campaign_service";

export class CampaignController {
    
  constructor(private readonly campaignService: CampaignService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const parsed = createCampaignSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
      return;
    }

    const user = res.locals.user as { id: string } | undefined;

    if (!user?.id) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    try {
      const campaign = await this.campaignService.createCampaign(
        user.id,
        parsed.data,
      );

      res.status(201).json({ campaign });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message === "SENDER_NOT_FOUND_OR_INACTIVE") {
        res.status(404).json({ error: message });
        return;
      }

      if (message === "CAMPAIGN_START_MUST_BE_IN_FUTURE") {
        res.status(400).json({ error: message });
        return;
      }

      if (message === "AUTHENTICATED_USER_REQUIRED") {
        res.status(401).json({ error: message });
        return;
      }

      console.error("Campaign creation failed", error);
      res.status(500).json({ error: "CAMPAIGN_CREATION_FAILED" });
    }
  };
}