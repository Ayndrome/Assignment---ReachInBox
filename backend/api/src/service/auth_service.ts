
import { createHash, randomBytes } from "node:crypto";
import { AuthRepository } from "../repositories/auth_repository";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async signInWithGoogle(input: {
    googleId: string;
    email: string;
    emailVerified: boolean;
    name: string;
    avatarUrl: string | null;
  }) {
    if (!input.emailVerified) {
      throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
    }

    let user = await this.authRepository.findUserByGoogleId(
      input.googleId,
    );

    if (!user) {
      const existingEmail = await this.authRepository.findUserByEmail(
        input.email,
      );

      // Never silently link a different Google identity by email alone.
      if (existingEmail) {
        throw new Error("ACCOUNT_LINKING_REQUIRED");
      }

      user = await this.authRepository.createGoogleUser({
        googleId: input.googleId,
        email: input.email.toLowerCase(),
        name: input.name,
        avatarUrl: input.avatarUrl,
      });
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.authRepository.createSession({
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      expiresAt,
    });

    return {
      sessionToken,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
      },
    };
  }

  async getSession(token: string) {
    if (!token) return null;

    const session = await this.authRepository.findValidSession(
      hashToken(token),
    );

    if (!session) return null;

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      avatarUrl: session.user.avatar_url,
    };
  }

  async signOut(token: string) {
    if (token) {
      await this.authRepository.deleteSession(hashToken(token));
    }
  }
}
