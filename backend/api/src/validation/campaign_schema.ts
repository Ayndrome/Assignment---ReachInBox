import z from "zod";

export const createCampaignSchema = z.object({
  senderId: z.uuid(),
  name: z.string().trim().min(1).max(150).optional(),
  subject: z.string().trim().min(1).max(998),
  bodyText: z.string().min(1),
  bodyHtml: z.string().optional(),
  
  startAt: z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/,
    "Format must be a local ISO text string without trailing timezone symbols (YYYY-MM-DDTHH:mm:ss)"
  ),
  
  delaySeconds: z.number().int().min(0).max(3600),
  hourlyLimit: z.number().int().min(1).max(3600),
  recipients: z
    .array(
      z.string().trim().pipe(z.email()).transform((email) => email.toLowerCase()),
    )
    .min(1)
    .max(1000)
    .transform((emails) => [...new Set(emails)]),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
