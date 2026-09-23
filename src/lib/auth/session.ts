import { cookies } from "next/headers";

import type { Organization, OrganizationMembership, User, UserProfile } from "@prisma/client";

import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { createOpaqueToken, hashToken, isValidSignature, signValue } from "@/lib/security";

export const SESSION_COOKIE_NAME = "atlas_innove_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type MembershipWithOrganization = OrganizationMembership & { organization: Organization };

export type AuthenticatedSession = {
  session: {
    id: string;
    activeOrganizationId: string | null;
  };
  user: User & { profile: UserProfile | null };
  memberships: MembershipWithOrganization[];
};

function encodeSessionCookie(sessionId: string, rawToken: string): string {
  const value = `${sessionId}.${rawToken}`;
  return `${value}.${signValue(value)}`;
}

function decodeSessionCookie(value: string): { sessionId: string; rawToken: string } | null {
  const [sessionId, rawToken, signature, ...extra] = value.split(".");
  if (!sessionId || !rawToken || !signature || extra.length > 0) {
    return null;
  }
  const signedValue = `${sessionId}.${rawToken}`;
  if (!isValidSignature(signedValue, signature)) {
    return null;
  }
  return { sessionId, rawToken };
}

async function setSessionCookie(value: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function createUserSession(userId: string, preferredOrganizationId?: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  if (!user) {
    throw new AuthorizationError("USER_NOT_FOUND");
  }

  const memberships = await db.organizationMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    select: { organizationId: true },
  });
  const membershipIds = new Set(memberships.map((membership) => membership.organizationId));
  const activeOrganizationId = preferredOrganizationId && membershipIds.has(preferredOrganizationId)
    ? preferredOrganizationId
    : memberships.length === 1
      ? memberships[0].organizationId
      : null;

  const rawToken = createOpaqueToken();
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      sessionVersion: user.sessionVersion,
      activeOrganizationId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });

  await setSessionCookie(encodeSessionCookie(session.id, rawToken));
}

async function readAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawCookie) {
    return null;
  }

  const decoded = decodeSessionCookie(rawCookie);
  if (!decoded) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { id: decoded.sessionId },
    include: {
      user: {
        include: {
          profile: true,
          memberships: { include: { organization: true } },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }
  if (session.tokenHash !== hashToken(decoded.rawToken)) {
    return null;
  }
  if (session.sessionVersion !== session.user.sessionVersion) {
    return null;
  }

  const memberships = session.user.memberships.filter(
    (membership) => membership.status === "ACTIVE" && membership.organization.status === "ACTIVE",
  );

  return {
    session: {
      id: session.id,
      activeOrganizationId: session.activeOrganizationId,
    },
    user: session.user,
    memberships,
  };
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  return readAuthenticatedSession();
}

export async function requireAuthenticatedSession(): Promise<AuthenticatedSession> {
  const session = await readAuthenticatedSession();
  if (!session) {
    throw new AuthorizationError("AUTHENTICATION_REQUIRED");
  }
  return session;
}

export async function getActiveOrganizationContext(): Promise<{
  auth: AuthenticatedSession;
  organization: Organization;
  membership: MembershipWithOrganization;
} | null> {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return null;
  }

  const membership = auth.memberships.find(
    (candidate) => candidate.organizationId === auth.session.activeOrganizationId,
  ) ?? (auth.memberships.length === 1 ? auth.memberships[0] : undefined);
  if (!membership) {
    return null;
  }

  return { auth, organization: membership.organization, membership };
}

export async function selectActiveOrganization(organizationId: string): Promise<void> {
  const auth = await requireAuthenticatedSession();
  const membership = auth.memberships.find((candidate) => candidate.organizationId === organizationId);
  if (!membership) {
    throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  }

  await db.session.update({
    where: { id: auth.session.id },
    data: { activeOrganizationId: organizationId },
  });
}

export async function revokeCurrentSession(): Promise<void> {
  const auth = await getAuthenticatedSession();
  if (auth) {
    await db.session.update({ where: { id: auth.session.id }, data: { revokedAt: new Date() } });
  }
  await clearSessionCookie();
}
