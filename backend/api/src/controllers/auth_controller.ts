import {
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import { googleOAuthClient } from "../config/google_oauth";
import { AuthService } from "../service/auth_service.js";

const SESSION_COOKIE = "session_token";
const STATE_COOKIE = "google_oauth_state";
const COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === "true";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
  };
}


function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return a.length === b.length && timingSafeEqual(a, b);
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  startGoogleOAuth = (_req: Request, res: Response): void => {
    const state = randomBytes(32).toString("hex");

    res.cookie(STATE_COOKIE, state, {
      ...cookieOptions(),
      maxAge: 10 * 60 * 1000,
    });

    const url = googleOAuthClient.generateAuthUrl({
      response_type: "code",
      scope: ["openid", "email", "profile"],
      state,
    });

    res.redirect(url);
  };

  googleCallback = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const stateCookie = req.cookies?.[STATE_COOKIE];
    const returnedState = req.query.state;
    const code = req.query.code;

    res.clearCookie(STATE_COOKIE, cookieOptions());

    if (
      typeof stateCookie !== "string" ||
      typeof returnedState !== "string" ||
      !safeEqual(stateCookie, returnedState)
    ) {
      res.status(400).send("Invalid OAuth state");
      return;
    }

    if (typeof code !== "string" || !code) {
      res.redirect(`${frontendUrl}/?auth=failed`);
      return;
    }

    try {
      const { tokens } = await googleOAuthClient.getToken(code);

      if (!tokens.id_token) {
        res.redirect(`${frontendUrl}/?auth=failed`);
        return;
      }

      const ticket = await googleOAuthClient.verifyIdToken({
        idToken: tokens.id_token,
        ...(process.env.GOOGLE_CLIENT_ID ? { audience: process.env.GOOGLE_CLIENT_ID } : {}),
        });

      const profile = ticket.getPayload();

      if (
        !profile?.sub ||
        !profile.email ||
        !profile.email_verified
      ) {
        res.redirect(`${frontendUrl}/?auth=failed`);
        return;
      }

      const result = await this.authService.signInWithGoogle({
        googleId: profile.sub,
        email: profile.email,
        emailVerified: profile.email_verified,
        name: profile.name ?? profile.email,
        avatarUrl: profile.picture ?? null,
      });

      res.cookie(SESSION_COOKIE, result.sessionToken, {
        ...cookieOptions(),
        expires: result.expiresAt,
      });

      res.redirect(`${frontendUrl}/?auth=success`);
    } catch (error: unknown) {
      console.error(
        "Google OAuth callback failed:",
        error instanceof Error ? error.message : "Unknown error",
      );

      res.redirect(`${frontendUrl}/?auth=failed`);
    }
  };

  me = (_req: Request, res: Response): void => {
    res.json({ user: res.locals.user });
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    const token = _req.cookies?.[SESSION_COOKIE];

    try {
      if (typeof token === "string") {
        await this.authService.signOut(token);
      }

      res.clearCookie(SESSION_COOKIE, cookieOptions());
      res.status(204).end();
    } catch {
      res.status(500).json({ error: "Unable to sign out" });
    }
  };
}
