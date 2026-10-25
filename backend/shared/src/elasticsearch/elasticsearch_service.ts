
import { Client } from "@elastic/elasticsearch";

export interface DeliveryDocument {
  id: string;
  campaign_id: string;
  user_id: string;
  sender_id: string;
  recipient_email: string;
  subject: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
}

export class ElasticsearchService {
  private readonly client: Client;
  private readonly index = "email_deliveries";

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_NODE ?? "http://localhost:9200",
    });
  }

  async indexDelivery(delivery: DeliveryDocument): Promise<void> {
    await this.client.index({
      index: this.index,
      id: delivery.id,
      document: delivery,
      refresh: true,
    });
  }

  async searchDeliveries(
    userId: string,
    query = "",
    status?: string,
  ): Promise<DeliveryDocument[]> {
    const filters: object[] = [
      { term: { user_id: userId } },
    ];

    if (status) {
      filters.push({ term: { status: status.toUpperCase() } });
    }

    const trimmedQuery = query.trim();

    const searchQuery = trimmedQuery
      ? {
          bool: {
            filter: filters,
            should: [
             
              {
                wildcard: {
                  "recipient_email.keyword": {
                    value: `*${trimmedQuery.replace(/[\\*?]/g, "\\$&")}*`,
                    case_insensitive: true,
                  },
                },
              },

              {
                match: {
                  subject: {
                    query: trimmedQuery,
                    operator: "and" as const,
                    fuzziness: "AUTO" as const,
                  },
                },
              },
              {
                match_phrase_prefix: {
                  subject: {
                    query: trimmedQuery,
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        }
      : {
          bool: {
            filter: filters,
          },
        };

    const result = await this.client.search<DeliveryDocument>({
      index: this.index,
      query: searchQuery,
      size: 1000,
      track_total_hits: true,
      sort: [
        { scheduled_at: { order: "desc", unmapped_type: "date" as const } },
      ],
    });

    return result.hits.hits
      .map((hit) => hit._source)
      .filter((document): document is DeliveryDocument => document !== undefined);
  }

  async createIndexIfNotExists(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.index,
    });

    if (!exists) {
      await this.client.indices.create({
        index: this.index,
        mappings: {
          properties: {
            id: { type: "keyword" },
            campaign_id: { type: "keyword" },
            user_id: { type: "keyword" },
            sender_id: { type: "keyword" },
            recipient_email: {
              type: "text",
              fields: {
                keyword: { type: "keyword" },
              },
            },
            subject: { type: "text" },
            status: { type: "keyword" },
            scheduled_at: { type: "date" },
            sent_at: { type: "date" },
            created_at: { type: "date" },
          },
        },
      });
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
