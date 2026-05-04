"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" as const };
  const role = (session.user as { role?: string }).role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { error: "Not authorized" as const };
  }
  return { session };
}

export async function sendInvoice(invoiceId: string) {
  try {
    const guard = await requireAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) return { success: false, error: "Invoice not found" };

    if (invoice.status !== "DRAFT") {
      return { success: false, error: "Only draft invoices can be sent" };
    }

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    // If linked to a job, update the job's invoiceSent flag
    if (invoice.jobId) {
      await db.$transaction([
        db.job.update({
          where: { id: invoice.jobId },
          data: { invoiceSent: true },
        }),
        db.jobLog.create({
          data: {
            jobId: invoice.jobId,
            userId: guard.session.user.id,
            action: "INVOICE_SENT",
            field: "invoiceSent",
            oldValue: "false",
            newValue: "true",
            description: `Invoice ${invoice.invoiceNumber} sent by ${guard.session.user.name}`,
          },
        }),
      ]);
      revalidatePath(`/jobs/${invoice.jobId}`);
      revalidatePath("/jobs");
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true };
  } catch (error) {
    console.error("Error sending invoice:", error);
    return { success: false, error: "Failed to send invoice" };
  }
}
