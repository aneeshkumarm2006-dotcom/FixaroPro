import { db } from "@/db";

// Configurable referral economics. These could live in AppSetting later.
export const NEW_CLIENT_DISCOUNT = 15; // $ off first booking when used
export const REFERRER_CREDIT = 10; // $ credited to the referring client

// Generates a short, friendly, unique referral code like "MAPLE4Q72".
function randomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O for readability
  const digits = "23456789"; // no 0, 1
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 4; i++) {
    out += digits[Math.floor(Math.random() * digits.length)];
  }
  return out;
}

export async function generateUniqueReferralCode(): Promise<string> {
  // Up to 8 attempts at finding a free code. Collision probability is tiny
  // (24^4 × 8^4 ≈ 1.4B keyspace).
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const existing = await db.client.findUnique({
      where: { referralCode: code },
    });
    if (!existing) return code;
  }
  // Fallback: include timestamp to guarantee uniqueness.
  return `R${Date.now().toString(36).toUpperCase()}`;
}

export async function ensureClientReferralCode(clientId: string): Promise<string> {
  const c = await db.client.findUnique({
    where: { id: clientId },
    select: { referralCode: true },
  });
  if (c?.referralCode) return c.referralCode;

  const code = await generateUniqueReferralCode();
  await db.client.update({
    where: { id: clientId },
    data: { referralCode: code },
  });
  return code;
}
