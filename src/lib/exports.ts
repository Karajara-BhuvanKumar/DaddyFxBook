// Export utilities for backtest sessions: CSV, XLSX, DOCX, PDF.
// Pure client-side. No backend changes.
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, ImageRun, PageBreak,
} from "docx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BacktestAnalytics, BacktestSession, BacktestTrade, BreakdownRow } from "./backtest";

// ---------- filename helpers ----------
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" }).replace(" ", "_");
}
export function buildFilenameBase(session: BacktestSession, trades: BacktestTrade[], kind: "Trades" | "Analytics") {
  const pair = (session.pair ?? "Session").replace(/[^A-Za-z0-9]/g, "");
  const dates = trades
    .map((t) => t.trade_date ?? t.created_at)
    .filter(Boolean)
    .map((d) => new Date(d as string))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return `${pair}_${session.name.replace(/\s+/g, "_")}_${kind}`;
  const start = fmtDate(dates[0]);
  const end = fmtDate(dates[dates.length - 1]);
  return `${pair}_${start}_to_${end}_${kind}`;
}

// ---------- row mapping ----------
const TRADE_HEADERS = [
  "Pair", "Direction", "Entry Price", "Stop Loss", "Take Profit", "Exit Price",
  "Risk Reward", "R Gained", "P&L", "Outcome", "Setup", "Session",
  "Market Condition", "Emotion", "Date", "Notes",
];
function tradeRow(t: BacktestTrade) {
  return [
    t.pair, t.direction, t.entry_price ?? "", t.stop_loss ?? "", t.take_profit ?? "",
    t.exit_price ?? "", t.rr ?? "", t.r_gained ?? "", t.pnl ?? "", t.outcome,
    t.setup ?? "", t.session ?? "", t.market_condition ?? "", t.emotion ?? "",
    t.trade_date ?? "", t.notes ?? "",
  ];
}

// ---------- CSV ----------
export function exportTradesCSV(session: BacktestSession, trades: BacktestTrade[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [TRADE_HEADERS.join(","), ...trades.map((t) => tradeRow(t).map(esc).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `${buildFilenameBase(session, trades, "Trades")}.csv`);
}

// ---------- XLSX ----------
export function exportTradesXLSX(session: BacktestSession, trades: BacktestTrade[]) {
  const ws = XLSX.utils.aoa_to_sheet([TRADE_HEADERS, ...trades.map(tradeRow)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trades");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([out], { type: "application/octet-stream" }), `${buildFilenameBase(session, trades, "Trades")}.xlsx`);
}

// ---------- chart rendering (offscreen canvas → PNG bytes) ----------
function renderChartPNG(opts: {
  width: number; height: number;
  data: { x: number; y: number }[];
  type: "area" | "line" | "bar";
  color: string;
  title: string;
  labels?: string[];
}): Uint8Array {
  const { width, height, data, type, color, title, labels } = opts;
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d")!;
  // bg
  ctx.fillStyle = "#0F1626";
  ctx.fillRect(0, 0, width, height);
  // title
  ctx.fillStyle = "#E5E7EB";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(title, 16, 22);

  const pad = { l: 44, r: 16, t: 36, b: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  if (data.length === 0) {
    ctx.fillStyle = "#64748B";
    ctx.font = "12px sans-serif";
    ctx.fillText("No data", pad.l, pad.t + h / 2);
    return new Uint8Array(atob(c.toDataURL("image/png").split(",")[1]).split("").map((ch) => ch.charCodeAt(0)));
  }

  const ys = data.map((d) => d.y);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const rangeY = maxY - minY || 1;
  const xs = data.map((d) => d.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rangeX = maxX - minX || 1;
  const sx = (x: number) => pad.l + ((x - minX) / rangeX) * w;
  const sy = (y: number) => pad.t + h - ((y - minY) / rangeY) * h;

  // grid
  ctx.strokeStyle = "rgba(148,163,184,0.18)";
  ctx.lineWidth = 1;
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#94A3B8";
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
    const val = maxY - (rangeY * i) / 4;
    ctx.fillText(val.toFixed(2), 6, y + 3);
  }
  // zero line
  if (minY < 0 && maxY > 0) {
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.beginPath(); ctx.moveTo(pad.l, sy(0)); ctx.lineTo(pad.l + w, sy(0)); ctx.stroke();
  }

  if (type === "bar") {
    const bw = Math.max(8, (w / data.length) * 0.6);
    data.forEach((d, i) => {
      const x = pad.l + (i + 0.5) * (w / data.length) - bw / 2;
      const y0 = sy(0); const y1 = sy(d.y);
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.min(y0, y1), bw, Math.abs(y1 - y0));
      if (labels?.[i]) {
        ctx.fillStyle = "#94A3B8";
        ctx.fillText(labels[i], x + bw / 2 - ctx.measureText(labels[i]).width / 2, height - 10);
      }
    });
  } else {
    // path
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = sx(d.x), y = sy(d.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (type === "area") {
      ctx.lineTo(sx(data[data.length - 1].x), sy(0));
      ctx.lineTo(sx(data[0].x), sy(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + h);
      grad.addColorStop(0, color + "AA");
      grad.addColorStop(1, color + "11");
      ctx.fillStyle = grad;
      ctx.fill();
      // stroke again
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = sx(d.x), y = sy(d.y);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const b64 = c.toDataURL("image/png").split(",")[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function buildCharts(a: BacktestAnalytics) {
  return {
    equity: renderChartPNG({
      width: 720, height: 260, type: "area", color: "#3B82F6", title: "Equity Curve (R)",
      data: a.equityCurve.map((p) => ({ x: p.idx, y: p.equity })),
    }),
    drawdown: renderChartPNG({
      width: 720, height: 260, type: "area", color: "#EF4444", title: "Drawdown (R)",
      data: a.drawdownCurve.map((p) => ({ x: p.idx, y: p.drawdown })),
    }),
    distribution: renderChartPNG({
      width: 720, height: 260, type: "bar", color: "#3B82F6", title: "Win / Loss Distribution",
      data: a.distribution.map((d, i) => ({ x: i, y: d.value })),
      labels: a.distribution.map((d) => d.name),
    }),
    perTrade: renderChartPNG({
      width: 720, height: 260, type: "line", color: "#22C55E", title: "Per-Trade R",
      data: a.equityCurve.map((p) => ({ x: p.idx, y: p.r })),
    }),
  };
}

// ---------- DOCX ----------
const DARK_BG = "0F1626";
const DARK_CELL = "1A2236";
const TEXT_LIGHT = "E5E7EB";
const MUTED = "94A3B8";
const PROFIT = "22C55E";
const LOSS = "EF4444";

function dHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: TEXT_LIGHT, size: level === HeadingLevel.TITLE ? 40 : 28 })],
  });
}
function dPara(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, bold: opts.bold, color: opts.color ?? TEXT_LIGHT, size: opts.size ?? 22 })],
  });
}
function dCell(text: string, opts: { header?: boolean; color?: string; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.CLEAR, fill: opts.header ? "243049" : DARK_CELL, color: "auto" },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "2C3650" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "2C3650" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "2C3650" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "2C3650" },
    },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.header, color: opts.color ?? TEXT_LIGHT, size: 20 })] })],
  });
}
function dTable(headers: string[], rows: string[][], widths?: number[]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h, i) => dCell(h, { header: true, width: widths?.[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => dCell(c, { width: widths?.[i] })) })),
    ],
  });
}

function breakdownRowsToTable(rows: BreakdownRow[]) {
  const header = ["Key", "Trades", "Win rate", "Net R"];
  const data = rows.map((r) => [r.key, String(r.trades), `${(r.winRate * 100).toFixed(1)}%`, `${r.netR >= 0 ? "+" : ""}${r.netR.toFixed(2)}R`]);
  return dTable(header, data.length ? data : [["—", "—", "—", "—"]], [4000, 1600, 1880, 1880]);
}

export async function exportAnalyticsDOCX(
  session: BacktestSession, trades: BacktestTrade[], a: BacktestAnalytics,
) {
  const charts = buildCharts(a);
  const img = (data: Uint8Array, title: string) => [
    dHeading(title, HeadingLevel.HEADING_3),
    new Paragraph({
      spacing: { after: 200 },
      children: [new ImageRun({ type: "png", data, transformation: { width: 600, height: 220 } })],
    }),
  ];

  const doc = new Document({
    background: { color: DARK_BG },
    styles: {
      default: { document: { run: { font: "Inter", color: TEXT_LIGHT, size: 22 } } },
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 120 },
          children: [new TextRun({ text: "DaddyFX Book", bold: true, color: "3B82F6", size: 24 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 360 },
          children: [new TextRun({ text: "Backtest Analytics Report", bold: true, color: TEXT_LIGHT, size: 44 })],
        }),

        dHeading("Session Information"),
        dTable(["Field", "Value"], [
          ["Name", session.name],
          ["Pair", session.pair ?? "—"],
          ["Strategy", session.strategy ?? "—"],
          ["Total trades", String(a.total)],
          ["Created", new Date(session.created_at).toLocaleDateString()],
        ], [3000, 6360]),

        dHeading("Performance Summary"),
        dTable(["Metric", "Value"], [
          ["Trades", String(a.total)],
          ["Wins", String(a.wins)],
          ["Losses", String(a.losses)],
          ["Break-even", String(a.breakeven)],
          ["Win rate", `${(a.winRate * 100).toFixed(2)}%`],
          ["Loss rate", `${(a.lossRate * 100).toFixed(2)}%`],
          ["Net R", `${a.netR >= 0 ? "+" : ""}${a.netR.toFixed(2)}`],
          ["Total R+", a.totalRGained.toFixed(2)],
          ["Total R−", a.totalRLost.toFixed(2)],
          ["Profit factor", a.profitFactor.toFixed(2)],
          ["Expectancy", `${a.expectancy.toFixed(2)}R`],
          ["Average RR", a.avgRR.toFixed(2)],
          ["Largest win", `${a.largestWinner.toFixed(2)}R`],
          ["Largest loss", `${a.largestLoser.toFixed(2)}R`],
          ["Max win streak", String(a.maxConsecutiveWins)],
          ["Max loss streak", String(a.maxConsecutiveLosses)],
          ["P&L", a.totalPnl.toFixed(2)],
        ], [3000, 6360]),

        new Paragraph({ children: [new PageBreak()] }),
        dHeading("Charts"),
        ...img(charts.equity, "Equity Curve"),
        ...img(charts.drawdown, "Drawdown Curve"),
        ...img(charts.distribution, "Win / Loss Distribution"),
        ...img(charts.perTrade, "Per-Trade R"),

        new Paragraph({ children: [new PageBreak()] }),
        dHeading("Breakdown — By Pair"),
        breakdownRowsToTable(a.byPair),
        dHeading("Breakdown — By Setup"),
        breakdownRowsToTable(a.bySetup),
        dHeading("Breakdown — By Session"),
        breakdownRowsToTable(a.bySession),
        dHeading("Breakdown — By Market Condition"),
        breakdownRowsToTable(a.byCondition),
        dHeading("Breakdown — Long vs Short"),
        breakdownRowsToTable(a.byDirection),

        dPara(`Generated ${new Date().toLocaleString()}`, { color: MUTED, size: 18 }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${buildFilenameBase(session, trades, "Analytics")}.docx`);
}

// ---------- PDF ----------
export function exportAnalyticsPDF(
  session: BacktestSession, trades: BacktestTrade[], a: BacktestAnalytics,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bg = "#0F1626";
  const text = "#E5E7EB";
  const muted = "#94A3B8";
  const accent = "#3B82F6";

  const drawBg = () => {
    doc.setFillColor(bg);
    doc.rect(0, 0, pageW, pageH, "F");
  };
  drawBg();

  // header
  doc.setTextColor(accent); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("DaddyFX Book", 40, 40);
  doc.setTextColor(text); doc.setFontSize(22);
  doc.text("Backtest Analytics Report", pageW / 2, 80, { align: "center" });
  doc.setTextColor(muted); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`${session.name} • ${session.pair ?? "—"} • Generated ${new Date().toLocaleString()}`, pageW / 2, 100, { align: "center" });

  const tableTheme = {
    theme: "grid" as const,
    headStyles: { fillColor: [36, 48, 73] as [number, number, number], textColor: text, fontStyle: "bold" as const },
    bodyStyles: { fillColor: [26, 34, 54] as [number, number, number], textColor: text },
    alternateRowStyles: { fillColor: [22, 28, 46] as [number, number, number] },
    styles: { lineColor: [44, 54, 80] as [number, number, number], lineWidth: 0.5, fontSize: 9 },
    margin: { left: 40, right: 40 },
    didDrawPage: () => drawBg(),
  };

  autoTable(doc, {
    ...tableTheme,
    startY: 130,
    head: [["Session Information", "Value"]],
    body: [
      ["Name", session.name],
      ["Pair", session.pair ?? "—"],
      ["Strategy", session.strategy ?? "—"],
      ["Total trades", String(a.total)],
      ["Created", new Date(session.created_at).toLocaleDateString()],
    ],
  });

  autoTable(doc, {
    ...tableTheme,
    head: [["Performance Summary", "Value"]],
    body: [
      ["Trades", String(a.total)],
      ["Wins", String(a.wins)],
      ["Losses", String(a.losses)],
      ["Break-even", String(a.breakeven)],
      ["Win rate", `${(a.winRate * 100).toFixed(2)}%`],
      ["Loss rate", `${(a.lossRate * 100).toFixed(2)}%`],
      ["Net R", `${a.netR >= 0 ? "+" : ""}${a.netR.toFixed(2)}`],
      ["Total R+", a.totalRGained.toFixed(2)],
      ["Total R−", a.totalRLost.toFixed(2)],
      ["Profit factor", a.profitFactor.toFixed(2)],
      ["Expectancy", `${a.expectancy.toFixed(2)}R`],
      ["Average RR", a.avgRR.toFixed(2)],
      ["Largest win", `${a.largestWinner.toFixed(2)}R`],
      ["Largest loss", `${a.largestLoser.toFixed(2)}R`],
      ["Max win streak", String(a.maxConsecutiveWins)],
      ["Max loss streak", String(a.maxConsecutiveLosses)],
      ["P&L", a.totalPnl.toFixed(2)],
    ],
  });

  // charts page
  doc.addPage(); drawBg();
  doc.setTextColor(text); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("Charts", 40, 50);

  const charts = buildCharts(a);
  const toDataUrl = (u: Uint8Array) => {
    let s = "";
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return "data:image/png;base64," + btoa(s);
  };
  const cw = pageW - 80; const ch = 180;
  let y = 70;
  const addChart = (label: string, data: Uint8Array) => {
    if (y + ch + 30 > pageH - 30) { doc.addPage(); drawBg(); y = 50; }
    doc.setTextColor(muted); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(label, 40, y + 12);
    doc.addImage(toDataUrl(data), "PNG", 40, y + 20, cw, ch);
    y += ch + 40;
  };
  addChart("Equity Curve (R)", charts.equity);
  addChart("Drawdown (R)", charts.drawdown);
  addChart("Win / Loss Distribution", charts.distribution);
  addChart("Per-Trade R", charts.perTrade);

  // breakdowns
  const addBreakdown = (title: string, rows: BreakdownRow[]) => {
    autoTable(doc, {
      ...tableTheme,
      head: [[title, "Trades", "Win rate", "Net R"]],
      body: rows.length
        ? rows.map((r) => [r.key, String(r.trades), `${(r.winRate * 100).toFixed(1)}%`, `${r.netR >= 0 ? "+" : ""}${r.netR.toFixed(2)}R`])
        : [["—", "—", "—", "—"]],
    });
  };
  doc.addPage(); drawBg();
  doc.setTextColor(text); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("Breakdowns", 40, 50);
  // force autoTable to start lower
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable = { finalY: 60 };
  addBreakdown("By Pair", a.byPair);
  addBreakdown("By Setup", a.bySetup);
  addBreakdown("By Session", a.bySession);
  addBreakdown("By Market Condition", a.byCondition);
  addBreakdown("Long vs Short", a.byDirection);

  doc.save(`${buildFilenameBase(session, trades, "Analytics")}.pdf`);
}
