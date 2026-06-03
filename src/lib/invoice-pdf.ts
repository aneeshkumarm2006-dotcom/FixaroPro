const BRAND = "#e85d04";
const INK   = "#161514";

export interface InvoicePdfData {
  invoiceNumber: number | string;
  createdAt: string;
  dueDate: string | null;
  status: string;
  client: { name: string; email: string | null; phone: string | null; address: string | null };
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  qstAmount: number;
  totalAmount: number;
  notes: string | null;
  taxConfig: { gstRate: number; qstRate: number; gstNumber: string; qstNumber: string };
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

export async function buildInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");
  const React = await import("react");

  const tint = (a: number) => `rgba(232, 93, 4, ${a})`;

  const S = StyleSheet.create({
    page:       { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: "Helvetica", color: INK },
    // Header
    headerRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: tint(0.2) },
    brand:      { fontSize: 22, color: BRAND, fontFamily: "Helvetica-Bold" },
    brandSub:   { fontSize: 9, color: tint(0.6), marginTop: 3 },
    docTitle:   { fontSize: 20, color: INK, fontFamily: "Helvetica-Bold", textAlign: "right" },
    docNum:     { fontSize: 10, color: tint(0.6), textAlign: "right", marginTop: 3 },
    docDate:    { fontSize: 9, color: tint(0.5), textAlign: "right", marginTop: 2 },
    // Info section
    infoRow:    { flexDirection: "row", marginBottom: 24 },
    infoCol:    { flex: 1 },
    sLabel:     { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, color: tint(0.55), marginBottom: 5 },
    sValue:     { fontSize: 10, color: INK, marginBottom: 2 },
    sMuted:     { fontSize: 9, color: tint(0.5), marginBottom: 1 },
    // Status badge
    badge:      { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, padding: "3 8", borderRadius: 4, backgroundColor: tint(0.1), color: BRAND, alignSelf: "flex-start", marginBottom: 6 },
    // Table
    tableHead:  { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: tint(0.25), marginBottom: 2 },
    tableHCell: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, color: tint(0.6) },
    tableRow:   { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: tint(0.1) },
    colDesc:    { flex: 3 },
    colQty:     { flex: 1, textAlign: "center" },
    colUnit:    { flex: 1, textAlign: "right" },
    colAmt:     { flex: 1, textAlign: "right" },
    // Totals
    totalsRow:  { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
    totalsBox:  { width: 210 },
    subtotalRow:{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: tint(0.1) },
    taxLbl:     { fontSize: 9, color: tint(0.6) },
    taxVal:     { fontSize: 9, color: INK },
    totalFinal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTopWidth: 1.5, borderTopColor: BRAND },
    totalLbl:   { fontSize: 12, fontFamily: "Helvetica-Bold", color: INK },
    totalVal:   { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND },
    // Notes
    notesBox:   { marginTop: 24, padding: "10 12", backgroundColor: tint(0.04), borderRadius: 4 },
    notesTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, color: tint(0.55), marginBottom: 5 },
    notesText:  { fontSize: 9, color: INK, lineHeight: 1.5 },
    // Tax line
    taxRegRow:  { flexDirection: "row", gap: 20, marginTop: 16 },
    taxReg:     { fontSize: 8, color: tint(0.5) },
    // Footer
    footer:     { position: "absolute", bottom: 32, left: 48, right: 48, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: tint(0.15), fontSize: 8, color: tint(0.45), flexDirection: "row", justifyContent: "space-between" },
  });

  const R = React.createElement;

  const doc = R(Document, null,
    R(Page, { size: "LETTER", style: S.page },

      // ── Header ──
      R(View, { style: S.headerRow },
        R(View, null,
          R(Text, { style: S.brand }, "Fixaro"),
          R(Text, { style: S.brandSub }, "Home Services · Montréal, QC"),
        ),
        R(View, null,
          R(Text, { style: S.docTitle }, "INVOICE"),
          R(Text, { style: S.docNum }, `#${data.invoiceNumber}`),
          R(Text, { style: S.docDate }, `Issued: ${new Date(data.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}`),
          data.dueDate
            ? R(Text, { style: S.docDate }, `Due: ${new Date(data.dueDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}`)
            : null,
        )
      ),

      // ── Bill-to + status ──
      R(View, { style: S.infoRow },
        R(View, { style: S.infoCol },
          R(Text, { style: S.sLabel }, "Bill to"),
          R(Text, { style: S.sValue }, data.client.name),
          data.client.email   ? R(Text, { style: S.sMuted }, data.client.email)   : null,
          data.client.phone   ? R(Text, { style: S.sMuted }, data.client.phone)   : null,
          data.client.address ? R(Text, { style: S.sMuted }, data.client.address) : null,
        ),
        R(View, { style: S.infoCol },
          R(Text, { style: S.sLabel }, "Status"),
          R(View, { style: S.badge }, R(Text, null, data.status)),
        ),
      ),

      // ── Line items table ──
      R(View, { style: S.tableHead },
        R(Text, { style: { ...S.tableHCell, ...S.colDesc } },  "Description"),
        R(Text, { style: { ...S.tableHCell, ...S.colQty } },   "Qty"),
        R(Text, { style: { ...S.tableHCell, ...S.colUnit } },  "Unit Price"),
        R(Text, { style: { ...S.tableHCell, ...S.colAmt } },   "Amount"),
      ),
      ...data.lineItems.map((li, i) =>
        R(View, { key: `li-${i}`, style: S.tableRow },
          R(Text, { style: { fontSize: 10, color: INK, flex: 3 } }, li.description),
          R(Text, { style: { fontSize: 10, color: tint(0.7), flex: 1, textAlign: "center" } }, String(li.quantity)),
          R(Text, { style: { fontSize: 10, color: tint(0.7), flex: 1, textAlign: "right" } }, fmt(li.unitPrice)),
          R(Text, { style: { fontSize: 10, color: INK, flex: 1, textAlign: "right" } }, fmt(li.amount)),
        )
      ),

      // ── Totals ──
      R(View, { style: S.totalsRow },
        R(View, { style: S.totalsBox },
          R(View, { style: S.subtotalRow },
            R(Text, { style: S.taxLbl }, "Subtotal"),
            R(Text, { style: S.taxVal }, fmt(data.subtotal)),
          ),
          data.discountAmount > 0
            ? R(View, { style: S.subtotalRow },
                R(Text, { style: S.taxLbl }, "Discount"),
                R(Text, { style: { ...S.taxVal, color: "#059669" } }, `−${fmt(data.discountAmount)}`),
              )
            : null,
          R(View, { style: S.subtotalRow },
            R(Text, { style: S.taxLbl }, `GST (${data.taxConfig.gstRate}%)`),
            R(Text, { style: S.taxVal }, fmt(data.gstAmount)),
          ),
          R(View, { style: S.subtotalRow },
            R(Text, { style: S.taxLbl }, `QST (${data.taxConfig.qstRate}%)`),
            R(Text, { style: S.taxVal }, fmt(data.qstAmount)),
          ),
          R(View, { style: S.totalFinal },
            R(Text, { style: S.totalLbl }, "Total Due"),
            R(Text, { style: S.totalVal }, fmt(data.totalAmount)),
          ),
        )
      ),

      // ── Notes ──
      data.notes
        ? R(View, { style: S.notesBox },
            R(Text, { style: S.notesTitle }, "Notes"),
            R(Text, { style: S.notesText }, data.notes),
          )
        : null,

      // ── Tax registrations ──
      (data.taxConfig.gstNumber || data.taxConfig.qstNumber)
        ? R(View, { style: S.taxRegRow },
            data.taxConfig.gstNumber ? R(Text, { style: S.taxReg }, `GST Reg: ${data.taxConfig.gstNumber}`) : null,
            data.taxConfig.qstNumber ? R(Text, { style: S.taxReg }, `QST Reg: ${data.taxConfig.qstNumber}`) : null,
          )
        : null,

      // ── Footer ──
      R(View, { style: S.footer },
        R(Text, null, "Fixaro Inc. · contact@fixaropro.com"),
        R(Text, null, `Invoice #${data.invoiceNumber}`),
      ),
    )
  );

  const stream = await pdf(doc as never).toBuffer();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end",  () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
