import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trade, Journal, Checklist } from '@/hooks/useTrades';

export interface ExportData {
  trades: Trade[];
  journals: Journal[];
  checklists: Checklist[];
  screenshots: any[];
}

export interface ExportOptions {
  includeFields: Record<string, boolean>;
  formats: string[]; // 'csv', 'xlsx', 'docx', 'pdf'
}

function getTradeData(data: ExportData, options: ExportOptions) {
  return data.trades.map(trade => {
    const journal = data.journals.find(j => j.trade_id === trade.id);
    const checklist = data.checklists.find(c => c.trade_id === trade.id);
    
    let row: any = {};
    if (options.includeFields.date) row['Date'] = new Date(trade.open_time).toLocaleString();
    if (options.includeFields.symbol) row['Symbol'] = trade.symbol;
    if (options.includeFields.direction) row['Direction'] = trade.direction;
    if (options.includeFields.entryPrice) row['Entry Price'] = trade.entry_price;
    if (options.includeFields.exitPrice) row['Exit Price'] = trade.exit_price;
    if (options.includeFields.pnl) row['P&L'] = trade.pnl;
    if (options.includeFields.riskReward) row['Risk Reward'] = journal?.risk_reward || '';
    if (options.includeFields.strategySetup) row['Strategy Setup'] = journal?.strategy_setup || '';
    if (options.includeFields.preTrade) row['Pre-Trade Analysis'] = journal?.pre_trade_notes || '';
    if (options.includeFields.postTrade) row['Post-Trade Review'] = journal?.post_trade_notes || '';
    if (options.includeFields.emotions) row['Emotions'] = journal?.emotions || '';
    if (options.includeFields.lessons) row['Lessons Learned'] = journal?.lessons || '';
    if (options.includeFields.tags) row['Tags'] = journal?.tags || '';
    if (options.includeFields.rating) row['Rating'] = journal?.rating || '';
    if (options.includeFields.session) row['Session'] = trade.session || '';
    
    return row;
  });
}

export const exportToCSV = (data: ExportData, options: ExportOptions) => {
  const rows = getTradeData(data, options);
  if (rows.length === 0) return;
  
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(header => `"${String(row[header]).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `Trading_Journal_${new Date().toISOString().split('T')[0]}.csv`);
};

export const exportToExcel = (data: ExportData, options: ExportOptions) => {
  const wb = XLSX.utils.book_new();
  
  // Summary Sheet
  const totalTrades = data.trades.length;
  const wins = data.trades.filter(t => t.pnl > 0).length;
  const losses = data.trades.filter(t => t.pnl < 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const netPnl = data.trades.reduce((sum, t) => sum + Number(t.pnl), 0);
  
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Trades', totalTrades],
    ['Wins', wins],
    ['Losses', losses],
    ['Win Rate', `${winRate.toFixed(2)}%`],
    ['Net P&L', `$${netPnl.toFixed(2)}`],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  // Trades Sheet
  const tradesData = getTradeData(data, options);
  const wsTrades = XLSX.utils.json_to_sheet(tradesData);
  XLSX.utils.book_append_sheet(wb, wsTrades, 'Trades');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Trading_Journal_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToWord = async (data: ExportData, options: ExportOptions) => {
  const children: any[] = [
    new Paragraph({
      text: "Trading Journal Report",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      text: `Generated on ${new Date().toLocaleString()}`,
    }),
  ];

  data.trades.forEach((trade, index) => {
    children.push(new Paragraph({
      text: `Trade #${index + 1}: ${trade.symbol} (${trade.direction})`,
      heading: HeadingLevel.HEADING_1,
    }));
    
    children.push(new Paragraph({ text: `Date: ${new Date(trade.open_time).toLocaleString()}` }));
    children.push(new Paragraph({ text: `P&L: $${trade.pnl}` }));
    
    const journal = data.journals.find(j => j.trade_id === trade.id);
    if (journal) {
      if (options.includeFields.preTrade && journal.pre_trade_notes) {
        children.push(new Paragraph({ text: "Pre-Trade Analysis", heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: journal.pre_trade_notes }));
      }
      if (options.includeFields.postTrade && journal.post_trade_notes) {
        children.push(new Paragraph({ text: "Post-Trade Review", heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: journal.post_trade_notes }));
      }
      if (options.includeFields.emotions && journal.emotions) {
        children.push(new Paragraph({ text: "Emotions", heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: journal.emotions }));
      }
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Trading_Journal_${new Date().toISOString().split('T')[0]}.docx`);
};

export const exportToPDF = (data: ExportData, options: ExportOptions) => {
  const doc = new jsPDF();
  
  // Cover Page
  doc.setFillColor(11, 11, 11);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("Trading Journal Report", 105, 100, { align: "center" });
  
  doc.setFontSize(14);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 120, { align: "center" });
  
  const totalTrades = data.trades.length;
  const wins = data.trades.filter(t => t.pnl > 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const netPnl = data.trades.reduce((sum, t) => sum + Number(t.pnl), 0);
  
  doc.setFontSize(12);
  doc.text(`Total Trades: ${totalTrades}`, 105, 140, { align: "center" });
  doc.text(`Win Rate: ${winRate.toFixed(2)}%`, 105, 150, { align: "center" });
  doc.text(`Net P&L: $${netPnl.toFixed(2)}`, 105, 160, { align: "center" });
  
  // Trades Table
  const tableData = getTradeData(data, options).map(obj => Object.values(obj));
  const tableHeaders = getTradeData(data, options).length > 0 ? Object.keys(getTradeData(data, options)[0]) : [];
  
  if (tableData.length > 0) {
    doc.addPage();
    doc.setFillColor(11, 11, 11);
    doc.rect(0, 0, 210, 297, 'F');
    
    autoTable(doc, {
      head: [tableHeaders],
      body: tableData as any,
      theme: 'grid',
      styles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], lineColor: [40, 40, 40] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      margin: { top: 20 },
    });
  }
  
  doc.save(`Trading_Journal_${new Date().toISOString().split('T')[0]}.pdf`);
};
