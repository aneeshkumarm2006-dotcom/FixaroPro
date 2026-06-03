import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf";
import { GST_RATE, QST_RATE } from "@/lib/tax";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true, phone: true, address: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber: invoice.invoiceNumber,
    createdAt: invoice.createdAt.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    status: invoice.status,
    client: {
      name: invoice.client?.name ?? "Client",
      email: invoice.client?.email ?? null,
      phone: invoice.client?.phone ?? null,
      address: invoice.client?.address ?? null,
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

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
