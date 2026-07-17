"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/role-routing";
import { sanitizeHttpUrl } from "@/lib/safe-url";

/**
 * External "where to buy" links attached to a Product (label + url).
 *
 * AUTHZ: writes are admin-only (isAdminRole — same guard as create/updateProduct,
 * which owns the rest of the product record). Fail closed on any missing session
 * or non-admin role.
 *
 * URL is allow-listed through sanitizeHttpUrl (absolute http/https only) BEFORE
 * it is ever stored, so a persisted value can never smuggle a javascript:/data:
 * scheme into an <a href> later. The stored URL is re-sanitized again in the
 * view before it becomes an href (defense in depth).
 */

// Hard caps — reject oversized payloads at the boundary rather than storing them.
const MAX_PRODUCT_LINKS = 20;
const MAX_LABEL_LENGTH = 100;

type Result = { success: true } | { success: false; error: string };

async function requireAdmin(): Promise<
  | { ok: true; actor: { id: string; name: string | null } }
  | { ok: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as
    | { id: string; name?: string | null; role?: string }
    | undefined;
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!isAdminRole(user.role)) return { ok: false, error: "Not authorized" };
  return { ok: true, actor: { id: user.id, name: user.name ?? null } };
}

export async function addProductLink(input: {
  productId: string;
  label?: string;
  url: string;
}): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  // ── Validate input (reject by default) ──────────────────────────────────
  const productId =
    typeof input?.productId === "string" ? input.productId.trim() : "";
  if (!productId) return { success: false, error: "Missing product." };

  const safeUrl = sanitizeHttpUrl(input?.url);
  if (!safeUrl) {
    return {
      success: false,
      error: "Enter a full http:// or https:// link.",
    };
  }

  const rawLabel = typeof input?.label === "string" ? input.label.trim() : "";
  const label = rawLabel ? rawLabel.slice(0, MAX_LABEL_LENGTH) : null;

  // Confirm the product exists before writing a child row against it.
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, _count: { select: { links: true } } },
  });
  if (!product) return { success: false, error: "Product not found." };

  if (product._count.links >= MAX_PRODUCT_LINKS) {
    return {
      success: false,
      error: `You can add up to ${MAX_PRODUCT_LINKS} links.`,
    };
  }

  try {
    await db.productLink.create({
      data: { productId, label, url: safeUrl },
    });
  } catch (e) {
    console.error("addProductLink", e);
    return { success: false, error: "Could not add this link." };
  }

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return { success: true };
}

export async function removeProductLink(input: {
  productId: string;
  linkId: string;
}): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };

  const productId =
    typeof input?.productId === "string" ? input.productId.trim() : "";
  const linkId = typeof input?.linkId === "string" ? input.linkId.trim() : "";
  if (!productId || !linkId) {
    return { success: false, error: "Missing link." };
  }

  // Scope the delete to BOTH ids so a caller can't remove a link that belongs
  // to a different product by guessing its id (IDOR guard). deleteMany returns
  // a count instead of throwing when nothing matches.
  try {
    const res = await db.productLink.deleteMany({
      where: { id: linkId, productId },
    });
    if (res.count === 0) {
      return { success: false, error: "Link not found." };
    }
  } catch (e) {
    console.error("removeProductLink", e);
    return { success: false, error: "Could not remove this link." };
  }

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return { success: true };
}
