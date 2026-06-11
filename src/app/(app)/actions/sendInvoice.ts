"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { revalidatePath } from "next/cache";
import { sendInvoiceEmail } from "@/lib/email";
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf";
import { GST_RATE, QST_RATE } from "@/lib/tax";

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
      include: {
        client: { select: { name: true, email: true, phone: true, address: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!invoice) return { success: false, error: "Invoice not found" };

    if (invoice.status === "CANCELLED") {
      return {
        success: false,
        error: "Cancelled invoices cannot be emailed",
      };
    }

    const wasDraft = invoice.status === "DRAFT";

    // Mark as SENT (if it was a draft) and stamp the send time.
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(wasDraft ? { status: "SENT" } : {}),
        sentAt: new Date(),
      },
    });

    // If linked to a job, flag it as invoiced and log the send.
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

    // Email the customer with the invoice PDF attached.
    if (!invoice.client?.email) {
      // Invoice is marked sent; there's just no address to email it to.
      return { success: true, emailed: false };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    // Generate PDF attachment
    let pdfAttachment: Array<{ filename: string; content: Buffer }> | undefined;
    try {
      const pdfBuffer = await buildInvoicePdfBuffer({
        invoiceNumber: invoice.invoiceNumber,
        createdAt: invoice.createdAt.toISOString(),
        dueDate: invoice.dueDate?.toISOString() ?? null,
        status: wasDraft ? "SENT" : invoice.status,
        client: {
          name: invoice.client.name,
          email: invoice.client.email,
          phone: invoice.client.phone ?? null,
          address: invoice.client.address ?? null,
        },
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: li.amount,
        })),
        subtotal: invoice.subtotal,
        discountAmount: invoice.discountAmount,
        gstAmount: invoice.gstAmount,
        qstAmount: invoice.qstAmount,
        totalAmount: invoice.totalAmount,
        notes: invoice.notes,
        taxConfig: {
          gstRate: GST_RATE * 100,
          qstRate: QST_RATE * 100,
          gstNumber: "",
          qstNumber: "",
        },
      });
      pdfAttachment = [{ filename: `invoice-${invoice.invoiceNumber}.pdf`, content: pdfBuffer }];
    } catch (pdfErr) {
      console.error("PDF generation failed, sending email without attachment", pdfErr);
    }

    const result = await sendInvoiceEmail({
      to: invoice.client.email,
      recipient: "CUSTOMER",
      event: wasDraft ? "new" : "resend",
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.totalAmount,
      clientName: invoice.client.name,
      link: `${appUrl}/portal/invoices/${invoice.id}`,
      attachments: pdfAttachment,
    });

    if (!result.ok) {
      return {
        success: false,
        error:
          ("error" in result && typeof result.error === "string"
            ? result.error
            : null) ?? "Email delivery failed",
      };
    }

    return { success: true, emailed: true };
  } catch (error) {
    console.error("Error sending invoice:", error);
    return { success: false, error: "Failed to send invoice" };
  }
}
