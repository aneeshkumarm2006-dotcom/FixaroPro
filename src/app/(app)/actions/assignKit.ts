"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import {
  recordInventoryChanges,
  type InventoryChangeRow,
} from "@/lib/inventory-change";

interface AssignKitParams {
  employeeId: string;
  kitTemplateId: string;
}

export async function assignKit(params: AssignKitParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Not authenticated" };
    const role = (session.user as { role?: string }).role;
    if (role !== "OWNER" && role !== "ADMIN") {
      return { success: false, error: "Not authorized" };
    }

    const { employeeId, kitTemplateId } = params;
    if (!employeeId || !kitTemplateId) {
      return { success: false, error: "Employee and kit template are required" };
    }

    const kit = await db.kitTemplate.findUnique({
      where: { id: kitTemplateId },
      include: { items: { include: { product: true } } },
    });
    if (!kit) return { success: false, error: "Kit template not found" };
    if (!kit.isActive) {
      return { success: false, error: "Kit template is inactive" };
    }
    if (kit.items.length === 0) {
      return { success: false, error: "Kit template has no products" };
    }

    const employee = await db.user.findUnique({ where: { id: employeeId } });
    if (!employee) return { success: false, error: "Employee not found" };

    const insufficient = kit.items.filter(
      (it) => it.product.stockLevel < it.quantity
    );
    if (insufficient.length > 0) {
      return {
        success: false,
        error: `Insufficient warehouse stock: ${insufficient
          .map((i) => `${i.product.name} (need ${i.quantity}, have ${i.product.stockLevel})`)
          .join(", ")}`,
      };
    }

    // Collected inside the transaction, logged after it commits (best-effort).
    const auditRows: InventoryChangeRow[] = [];
    const actor = session.user as { id: string; name?: string };

    await db.$transaction(async (tx) => {
      for (const item of kit.items) {
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stockLevel: { decrement: item.quantity } },
        });

        const existing = await tx.employeeProduct.findUnique({
          where: {
            employeeId_productId: {
              employeeId,
              productId: item.productId,
            },
          },
        });

        let newKitQty: number;
        if (existing) {
          const updatedKit = await tx.employeeProduct.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
          newKitQty = updatedKit.quantity;
        } else {
          const createdKit = await tx.employeeProduct.create({
            data: {
              employeeId,
              productId: item.productId,
              quantity: item.quantity,
              notes: `Assigned via kit: ${kit.name}`,
            },
          });
          newKitQty = createdKit.quantity;
        }

        // Warehouse gave up the units …
        auditRows.push({
          productId: item.productId,
          employeeId: null,
          employeeName: null,
          quantityChange: -item.quantity,
          newQuantity: updatedProduct.stockLevel,
          unit: item.product.unit,
          reason: `Kit assigned to ${employee.name ?? "Pro"}: ${kit.name}`,
          changedById: actor.id,
          changedByName: actor.name ?? null,
        });
        // … the Pro's kit received them.
        auditRows.push({
          productId: item.productId,
          employeeId,
          employeeName: employee.name ?? null,
          quantityChange: item.quantity,
          newQuantity: newKitQty,
          unit: item.product.unit,
          reason: `Kit assigned: ${kit.name}`,
          changedById: actor.id,
          changedByName: actor.name ?? null,
        });
      }
    });

    await recordInventoryChanges(auditRows);

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/inventory");
    return { success: true };
  } catch (error) {
    console.error("Error assigning kit:", error);
    return { success: false, error: "Failed to assign kit" };
  }
}
