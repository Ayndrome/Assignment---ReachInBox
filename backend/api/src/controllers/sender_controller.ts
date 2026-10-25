import type { Request, Response } from "express";
import type { PrismaClient } from "../../../generated/prisma/client.js";

export class SenderController {
  constructor(private readonly prisma: PrismaClient) {}

  create = async (req: Request, res: Response) => {
    const user = res.locals.user as { id: string } | undefined;
    if (!user?.id) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    const { email, display_name, smtp_host, smtp_port, smtp_user, smtp_password } = req.body;

    try {
      const sender = await this.prisma.senders.create({
        data: {
          user_id: user.id,
          email,
          display_name,
          smtp_host,
          smtp_port: parseInt(smtp_port),
          smtp_user,
          smtp_password_encrypted: smtp_user, // In real app, encrypt this
          is_active: true,
        },
      });

      res.status(201).json({ sender });
    } catch (error) {
      console.error("Failed to create sender", error);
      res.status(500).json({ error: "SENDER_CREATION_FAILED" });
    }
  };

  list = async (_req: Request, res: Response) => {
    const user = res.locals.user as { id: string } | undefined;
    if (!user?.id) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    const senders = await this.prisma.senders.findMany({
      where: { user_id: user.id, is_active: true },
    });

    res.json({ senders });
  };
}
