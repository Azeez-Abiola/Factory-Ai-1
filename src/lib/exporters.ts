import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadTablePDF(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  orientation?: "portrait" | "landscape";
}) {
  const doc = new jsPDF({ orientation: opts.orientation ?? "landscape" });
  doc.setFontSize(16);
  doc.text(opts.title, 14, 15);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(opts.subtitle, 14, 22);
  }
  autoTable(doc, {
    startY: opts.subtitle ? 27 : 22,
    head: [opts.head],
    body: opts.body.map((r) => r.map((c) => String(c ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(opts.filename);
}
