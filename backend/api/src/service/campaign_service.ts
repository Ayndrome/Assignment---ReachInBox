import type { CreateCampaignInput } from "../validation/campaign_schema";
import { CampaignRepository } from "../repositories/campaign_repository";

export class CampaignService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
  ) {}

  async createCampaign(
    userId: string,
    input: CreateCampaignInput,
  ) {
    if (!userId.trim()) {
      throw new Error("AUTHENTICATED_USER_REQUIRED");
    }

    const startAt = new Date(input.startAt);

    if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
      throw new Error("CAMPAIGN_START_MUST_BE_IN_FUTURE");
    }
    

    return this.campaignRepository.createScheduledCampaign(
      userId,
      input,
    );
  }
}
