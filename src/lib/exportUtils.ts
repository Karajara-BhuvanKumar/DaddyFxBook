import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
import { buildJournalCSV, journalExportRows, journalExportSections, exportValueText, type ExportData, type ExportOptions } from './journalExport';
export type { ExportData, ExportOptions } from './journalExport';

const filename = (extension: string) => `TradeFXBook_Journal_${new Date().toISOString().slice(0, 10)}.${extension}`;
export function exportToCSV(data: ExportData, options: ExportOptions) {
  saveAs(new Blob([buildJournalCSV(data, options)], { type: 'text/csv;charset=utf-8;' }), filename('csv'));
}

export function buildJournalWorkbook(data: ExportData, options: ExportOptions) {
  const wb = XLSX.utils.book_new();
  const wins = data.trades.filter(t => Number(t.pnl) > 0).length;
  const summary = XLSX.utils.aoa_to_sheet([
    ['TradeFXBook Journal', 'Value'], ['Exported trades', data.trades.length],
    ['Journaled trades', data.trades.filter(t => data.journals.some(j => j.trade_id === t.id)).length],
    ['Wins', wins], ['Losses', data.trades.filter(t => Number(t.pnl) < 0).length],
    ['Win rate', data.trades.length ? wins / data.trades.length : 0],
    ['Net P&L', data.trades.reduce((sum, t) => sum + Number(t.pnl), 0)],
    ['Date/time convention', 'UTC'], ['Screenshots', 'Original storage references; PDF embeds available images.'],
  ]);
  summary.B6.z = '0.00%'; summary.B7.z = '#,##0.00;[Red]-#,##0.00';
  summary['!cols'] = [{ wch: 26 }, { wch: 64 }];
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');
  const rows = journalExportRows(data, options);
  // Store UTC wall-clock dates as Excel serial numbers, independent of the device timezone.
  const headers = Object.keys(rows[0] || {});
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows.map(row => headers.map(key => {
    const value = row[key];
    return value instanceof Date ? value.getTime() / 86400000 + 25569 : value ?? '';
  }))]);
  headers.forEach((header, col) => {
    for (let row = 1; row <= rows.length; row++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell) continue;
      if (header.includes('date/time') && cell.t === 'n') cell.z = 'yyyy-mm-dd hh:mm:ss';
      else if (['Entry', 'Exit', 'Size', 'Stop loss', 'Take profit'].includes(header) && cell.t === 'n') cell.z = '0.########';
      else if (header === 'P&L' && cell.t === 'n') cell.z = '#,##0.00;[Red]-#,##0.00';
    }
  });
  sheet['!cols'] = headers.map(h => ({ wch: /Analysis|Review|Lessons|Strategy|Confluences|references/.test(h) ? 52 : h.includes('date/time') ? 24 : Math.max(14, Math.min(h.length + 3, 30)) }));
  sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1' };
  sheet['!rows'] = [{ hpt: 28 }, ...rows.map(() => ({ hpt: 32 }))];
  XLSX.utils.book_append_sheet(wb, sheet, 'Journal entries');
  return wb;
}
export function exportToExcel(data: ExportData, options: ExportOptions) {
  const bytes = XLSX.write(buildJournalWorkbook(data, options), { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename('xlsx'));
}

// Retain the existing editable Word export alongside the three primary formats.
export async function exportToWord(data: ExportData, options: ExportOptions) {
  const children = [new Paragraph({ text: 'TradeFXBook · Trading Journal', heading: HeadingLevel.TITLE })];
  data.trades.forEach((trade, index) => {
    children.push(new Paragraph({ text: `${index + 1}. ${trade.symbol} · ${trade.direction}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: index > 0 }));
    journalExportSections(trade, data, options).forEach(section => {
      children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }));
      section.fields.forEach(([label, value]) => children.push(new Paragraph({ text: `${label}: ${exportValueText(value)}` })));
    });
  });
  saveAs(await Packer.toBlob(new Document({ sections: [{ children }] })), filename('docx'));
}

async function loadScreenshot(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = window.setTimeout(() => { img.src = ''; reject(new Error('Screenshot timed out')); }, 15000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('Screenshot unavailable')); };
    img.src = url;
  });
}

export async function buildJournalPDF(data: ExportData, options: ExportOptions) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({ title: 'TradeFXBook Trading Journal', author: 'TradeFXBook', subject: `${data.trades.length} trade journals` });
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const margin = 38, contentWidth = width - margin * 2, bottom = height - 40;
  let y = 0, identity = 'Trading Journal', missingImages = 0;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the PDF. Please try again.');
  // Use browser font fallback for international journal text; Latin text stays selectable.
  function text(value: string, x: number, baseline: number, size = 10, color = '#e4e4e7', bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    if (/[^\u0020-\u00ff]/.test(value)) {
      context.font = `${bold ? 'bold ' : ''}${size * 2}px Arial, sans-serif`;
      const measured = context.measureText(value).width;
      canvas.width = Math.ceil(measured + 8); canvas.height = Math.ceil(size * 3);
      context.font = `${bold ? 'bold ' : ''}${size * 2}px Arial, sans-serif`;
      context.fillStyle = color; context.textBaseline = 'top'; context.fillText(value, 0, 0);
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, baseline - size, canvas.width / 2, canvas.height / 2);
    } else doc.text(value, x, baseline);
  }
  function page(add = true) {
    if (add) doc.addPage();
    doc.setFillColor('#0b0b0d'); doc.rect(0, 0, width, height, 'F');
    doc.setFillColor('#2563eb'); doc.rect(0, 0, width, 4, 'F');
    text('TradeFXBook', margin, 30, 11, '#60a5fa', true);
    text(identity, margin, 51, 10, '#a1a1aa');
    y = 74;
  }
  function ensure(space: number) { if (y + space > bottom) page(); }
  function wrap(value: string, size: number, availableWidth = contentWidth - 24): string[] {
    context.font = `${size * 2}px Arial, sans-serif`;
    const lines: string[] = [];
    for (const paragraph of value.replace(/\r\n?/g, '\n').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/(\s+)/)) {
        if (context.measureText(line + word).width / 2 <= availableWidth) { line += word; continue; }
        if (line.trim()) lines.push(line.trimEnd());
        line = '';
        // Even an unbroken URL or very long tag must fit inside the page.
        for (const char of Array.from(word.trimStart())) {
          if (context.measureText(line + char).width / 2 > availableWidth) { lines.push(line); line = ''; }
          line += char;
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }
  function section(title: string) {
    ensure(64); doc.setFillColor('#17243d'); doc.roundedRect(margin, y, contentWidth, 25, 4, 4, 'F');
    text(title, margin + 10, y + 17, 10, '#93c5fd', true); y += 37;
  }
  function field(label: string, value: string) {
    ensure(42); text(label, margin + 10, y, 9, '#a1a1aa', true); y += 15;
    for (const line of wrap(value, 10)) {
      if (y + 14 > bottom) { page(); text(`${label} (continued)`, margin + 10, y, 9, '#a1a1aa', true); y += 16; }
      text(line, margin + 10, y); y += 14;
    }
    y += 10;
  }
  for (const [index, trade] of data.trades.entries()) {
    identity = `Journal ${index + 1} of ${data.trades.length} · ${trade.symbol} · ${trade.direction}`;
    page(index > 0);
    text(`${trade.symbol}  /  ${trade.direction}`, margin, y, 20, '#fafafa', true); y += 27;
    text(`${Number(trade.pnl) >= 0 ? '+' : ''}${Number(trade.pnl).toFixed(2)} P&L`, margin, y, 13, Number(trade.pnl) >= 0 ? '#60a5fa' : '#f87171', true); y += 28;
    for (const group of journalExportSections(trade, data, options)) {
      if (group.title === 'Screenshots') continue;
      section(group.title);
      if (group.title === 'Analysis & reflections') {
        group.fields.forEach(([label, value]) => field(label, exportValueText(value)));
        continue;
      }
      let fields = group.fields;
      if (group.title === 'Strategy Setup') {
        const raw = data.journals.find(j => j.trade_id === trade.id)?.strategy_setup;
        let structured = false;
        try { structured = !!raw && typeof JSON.parse(raw) === 'object'; } catch { /* Legacy free text is preserved. */ }
        if (structured) fields = fields.filter(([label]) => !['Strategy Setup', 'Confirmation timeframe', 'Confirmation type'].includes(label));
        else { field('Strategy Setup', exportValueText(fields[0][1])); fields = fields.slice(1); }
      }
      // Pair short facts, wrapping values independently rather than squeezing a wide table.
      for (let i = 0; i < fields.length; i += 2) {
        const pair = fields.slice(i, i + 2).map(([label, value]) => ({ label, lines: wrap(value instanceof Date ? value.toISOString().replace('T', ' ').replace('.000Z', ' UTC') : exportValueText(value), 10, contentWidth / 2 - 24) }));
        const rowHeight = Math.max(...pair.map(item => item.lines.length)) * 13 + 22;
        if (rowHeight > bottom - 115) { fields.slice(i, i + 2).forEach(([label, value]) => field(label, exportValueText(value))); continue; }
        if (y + rowHeight > bottom) { page(); section(`${group.title} (continued)`); }
        pair.forEach(({ label, lines }, col) => {
          const x = margin + 10 + col * contentWidth / 2;
          text(label, x, y, 8, '#a1a1aa');
          lines.forEach((line, lineIndex) => text(line, x, y + 15 + lineIndex * 13, 10));
        });
        y += rowHeight;
      }
    }
    if (options.includeFields.screenshots !== false) {
      const screenshots = data.screenshots.filter(s => s.trade_id === trade.id);
      for (const [imageIndex, shot] of screenshots.entries()) {
        try {
          const image = await loadScreenshot(shot.signed_url || shot.image_url);
          const ratio = Math.min(contentWidth / image.naturalWidth, 360 / image.naturalHeight);
          const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
          ensure(h + (imageIndex === 0 ? 77 : 40));
          if (imageIndex === 0) section('Screenshots');
          text(`Screenshot ${imageIndex + 1}`, margin, y, 9, '#a1a1aa'); y += 12;
          const imageCanvas = document.createElement('canvas');
          const imageScale = Math.min(1, 1800 / image.naturalWidth, 1800 / image.naturalHeight);
          imageCanvas.width = Math.max(1, Math.round(image.naturalWidth * imageScale));
          imageCanvas.height = Math.max(1, Math.round(image.naturalHeight * imageScale));
          imageCanvas.getContext('2d')!.drawImage(image, 0, 0, imageCanvas.width, imageCanvas.height);
          doc.addImage(imageCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', margin + (contentWidth - w) / 2, y, w, h); y += h + 22;
        } catch {
          if (imageIndex === 0) section('Screenshots');
          missingImages++; field(`Screenshot ${imageIndex + 1} unavailable`, shot.image_url);
        }
      }
    }
  }
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p); text(`TradeFXBook  |  Dates in UTC  |  ${p} / ${doc.getNumberOfPages()}`, margin, height - 18, 8, '#71717a');
  }
  return { doc, missingImages };
}
export async function exportToPDF(data: ExportData, options: ExportOptions) {
  const result = await buildJournalPDF(data, options);
  result.doc.save(filename('pdf'));
  return result.missingImages;
}
