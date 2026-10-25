
import type { PrismaClient } from "../../../generated/prisma/client";

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUserByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { google_id: googleId },
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  createGoogleUser(input: {
    googleId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  }) {
    return this.prisma.user.create({
      data: {
        google_id: input.googleId,
        name: input.name,
        email: input.email,
        avatar_url: input.avatarUrl,
      },
    });
  }

  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.sessions.create({
      data: {
        user_id: input.userId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
      },
    });
  }

  findValidSession(tokenHash: string) {
    return this.prisma.sessions.findFirst({
      where: {
        token_hash: tokenHash,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  deleteSession(tokenHash: string) {
    return this.prisma.sessions.deleteMany({
      where: { token_hash: tokenHash },
    });
  }
}
