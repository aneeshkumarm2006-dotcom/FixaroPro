"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminRole } from "@/lib/role-routing";
import { syncDefaultLocationStock } from "@/lib/inventory";
import { recordInventoryChanges } from "@/lib/inventory-change";
import { revalidatePath } from "next/cache";
import type { ProductCategory } from "@prisma/client";

const ALLOWED_CATEGORIES: readonly ProductCategory[] = [
  "LIQUID_SPRAY",
  "MOP_LIQUID",
  "DISPOSABLE",
  "TOOL",
  "OTHER",
];

type State = {
  message: string;
  error: string;
};

export async function updateProduct(
  productId: string,
  prevState: State,
  formData: FormData
): Promise<State> {
  // Inventory mutation is admin-only (costPerUnit feeds expense accounting).
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminRole((session.user as { role?: string }).role)) {
    return { message: "", error: "Not authorized." };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const unit = formData.get("unit") as string;
  const costPerUnit = parseFloat(formData.get("costPerUnit") as string);
  const stockLevel = parseFloat(formData.get("stockLevel") as string);
  const minStock = parseFloat(formData.get("minStock") as string);
  const categoryRaw = (formData.get("category") as string) || "OTHER";
  const category: ProductCategory = ALLOWED_CATEGORIES.includes(categoryRaw as ProductCategory)
    ? (categoryRaw as ProductCategory)
    : "OTHER";

  // Validate required fields
  if (!name || !unit || isNaN(costPerUnit) || isNaN(stockLevel) || isNaN(minStock)) {
    return {
      message: "",
      error: "Please fill in all required fields with valid values.",
    };
  }

  // Validate numeric values
  if (costPerUnit < 0 || stockLevel < 0 || minStock < 0) {
    return {
      message: "",
      error: "Numeric values cannot be negative.",
    };
  }

  try {
    // Check if product name already exists (excluding current product)
    const existingProduct = await db.product.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        NOT: {
          id: productId,
        },
      },
    });

    if (existingProduct) {
      return {
        message: "",
        error: "A product with this name already exists.",
      };
    }

    // Capture the previous stock so we can apply the change as a delta to the
    // default location (preserves stock manually distributed to other locations).
    const previous = await db.product.findUnique({
      where: { id: productId },
      select: { stockLevel: true },
    });

    // Update the product
    await db.product.update({
      where: { id: productId },
      data: {
        name,
        description: description || null,
        unit,
        costPerUnit,
        stockLevel,
        minStock,
        category,
      },
    });

    // Keep the cleaner-facing per-location stock in sync with the admin edit.
    const stockDelta = stockLevel - (previous?.stockLevel ?? 0);
    await syncDefaultLocationStock(productId, stockDelta);

    // Best-effort warehouse audit row (skipped when the count didn't move).
    const actor = session.user as { id: string; name?: string };
    await recordInventoryChanges([
      {
        productId,
        employeeId: null,
        employeeName: null,
        quantityChange: stockDelta,
        newQuantity: stockLevel,
        unit,
        reason: "Stock level edited by admin",
        changedById: actor.id,
        changedByName: actor.name ?? null,
      },
    ]);

    revalidatePath("/inventory");
    return {
      message: "Product updated successfully!",
      error: "",
    };
  } catch (error) {
    console.error("Error updating product:", error);
    return {
      message: "",
      error: "Failed to update product. Please try again.",
    };
  }
}

