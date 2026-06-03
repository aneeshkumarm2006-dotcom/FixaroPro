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
    if (!["DRAFT", "SENT"].includes(invoice.status)) {
      return { success: false, error: "Only draft or sent invoices can be emailed" };
    }

    const isFirstSend = invoice.status === "DRAFT";

    // Mark as SENT if it was a draft
    if (isFirstSend) {
      await db.invoice.update({
        where: { id: invoiceId },
        data: { status: "SENT", sentAt: new Date() },
      });

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
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);

    // Send email with PDF attached if client has an email
    if (invoice.client?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

      // Generate PDF attachment
      let pdfAttachment: Array<{ filename: string; content: Buffer }> | undefined;
      try {
        const pdfBuffer = await buildInvoicePdfBuffer({
          invoiceNumber: invoice.invoiceNumber,
          createdAt: invoice.createdAt.toISOString(),
          dueDate: invoice.dueDate?.toISOString() ?? null,
          status: isFirstSend ? "SENT" : invoice.status,
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

      await sendInvoiceEmail({
        to: invoice.client.email,
        recipient: "CUSTOMER",
        event: isFirstSend ? "new" : "resend",
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
        clientName: invoice.client.name,
        link: `${appUrl}/invoices/${invoice.id}`,
        attachments: pdfAttachment,
      }).catch((e) => console.error("invoice email", e));
    }

    return { success: true, emailed: !!invoice.client?.email };
  } catch (error) {
    console.error("Error sending invoice:", error);
    return { success: false, error: "Failed to send invoice" };
  }
}
