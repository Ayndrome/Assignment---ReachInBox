import type { Request, Response } from "express";
import { SlackService } from "../../../shared/src/slack/slack_service.js";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "slack_oauth_state";

export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  startOAuth = async (_req: Request, res: Response) => {
    const state = randomBytes(32).toString("hex");

    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    const url = await this.slackService.getOAuthUrl(state);
    res.redirect(url);
  };

  callback = async (req: Request, res: Response) => {
    const user = res.locals.user as { id: string } | undefined;
    if (!user?.id) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }

    const stateCookie = req.cookies?.[STATE_COOKIE];
    const returnedState = req.query.state;
    const code = req.query.code;

    res.clearCookie(STATE_COOKIE);

    if (!stateCookie || stateCookie !== returnedState) {
      res.status(400).send("Invalid Slack OAuth state");
      return;
    }

    if (typeof code !== "string" || !code) {
      res.redirect(`${process.env.FRONTEND_URL}/?slack=failed`);
      return;
    }

    try {
      await this.slackService.handleCallback(user.id, code);
      res.redirect(`${process.env.FRONTEND_URL}/?slack=success`);
    } catch (error) {
      console.error("Slack OAuth failed", error);
      res.redirect(`${process.env.FRONTEND_URL}/?slack=failed`);
    }
  };

  getConnection = async (_req: Request, res: Response) => {
      const user = res.locals.user as { id: string } | undefined;
      if (!user?.id) {
          res.status(401).json({ error: "UNAUTHENTICATED" });
          return;
      }

      const connection = await this.slackService.getConnection(user.id);

      res.json({ connection });
  };
}
