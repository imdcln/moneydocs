import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "moneydocs-auth-secret-key-salt";

export interface CollisionTokenPayload {
  email: string;
  providerAccountId: string;
  name?: string;
  image?: string;
  exp: number;
}

export function generateCollisionToken(payload: Omit<CollisionTokenPayload, "exp">, expiresInMinutes = 10): string {
  const data: CollisionTokenPayload = {
    ...payload,
    exp: Date.now() + expiresInMinutes * 60 * 1000,
  };
  const str = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(str).digest("base64url");
  return `${str}.${sig}`;
}

export function verifyCollisionToken(token: string): CollisionTokenPayload | null {
  try {
    const [str, sig] = token.split(".");
    if (!str || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", SECRET).update(str).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(str, "base64url").toString("utf8")) as CollisionTokenPayload;
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
