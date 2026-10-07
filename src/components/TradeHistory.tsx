import { Fragment, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, DollarSign, Download, FileSpreadsheet, FileText, Filter, GripVertical, Pencil, RotateCcw, Share2, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Close as PopoverClose } from '@radix-ui/react-popover';
import { toast } from 'sonner';
import type { Trade } from '@/hooks/useTrades';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TradeHistoryFilters from '@/components/TradeHistoryFilters';
import { COLUMNS, DEFAULT_COLUMNS, DEFAULT_FILTERS, DEFAULT_SORT, columnText, columnValue, exportHistoryRows, filterHistory, formatHistoryDate, historyCsv, isFiltersActive, sortHistory, type ColumnId, type HistoryTrade, type Sort } from '@/lib/tradeHistory';
import './TradeHistory.css';

type Props = { trades: HistoryTrade[]; onEdit: (trade: Trade) => void; onShare: (trade: Trade) => void; onDelete: (id: string) => void };
const labelFor = (id: ColumnId) => COLUMNS.find(c => c[0] === id)![1];
const money = (n: number, signed = false) => `${signed ? n >= 0 ? '+' : '-' : n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Cell({ trade: t, column: id }: { trade: HistoryTrade; column: ColumnId }) {
  const value = columnValue(t, id);
  if (id === 'openClose') return <div className="th-dates"><div>Open: <span>{formatHistoryDate(t.open_time)}</span></div><div>Close: <span>{formatHistoryDate(t.close_time)}</span></div></div>;
  if (id === 'symbol') return <span className="th-symbol"><span className="th-coin"><DollarSign size={14} /></span><strong>{t.symbol}</strong></span>;
  if (id === 'direction') return <span className={`th-direction ${t.direction === 'Long' ? 'th-profit' : 'th-loss'}`}>{t.direction === 'Long' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{t.direction}</span>;
  if (id === 'source') return <span className="th-source"><Pencil size={13} />{columnText(t, id)}</span>;
  if (['pnl', 'net_pnl'].includes(id)) return <strong title={id === 'net_pnl' && t.net_pnl == null ? 'Stored realized P&L; separate fees are not recorded.' : undefined} className={`th-pnl ${Number(value) >= 0 ? 'th-profit' : 'th-loss'}`}>{money(Number(value), true)}</strong>;
  if (['entry_price', 'exit_price', 'commission', 'swap'].includes(id)) return value === null ? <span className="th-missing">Not recorded</span> : <strong>{money(Number(value))}</strong>;
  if (id === 'notes') return <span className="th-notes">{columnText(t, id) || '—'}</span>;
  return <span>{columnText(t, id)}</span>;
}

export default function TradeHistory({ trades, onEdit, onShare, onDelete }: Props) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [order, setOrder] = useState<ColumnId[]>(COLUMNS.map(([id]) => id));
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_COLUMNS);
  const [sorts, setSorts] = useState<Sort[]>(DEFAULT_SORT);
  const [height, setHeight] = useState('Default');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [columnFiltersOn, setColumnFiltersOn] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<ColumnId, string>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mobileViewTab, setMobileViewTab] = useState<'display' | 'columns'>('display');
  const columns = order.filter(id => visible.includes(id));
  const summaryColumns = columns.filter(id => ['symbol', 'direction', 'pnl'].includes(id));
  const activeColumnFilters = useMemo(() => columnFiltersOn ? Object.fromEntries(Object.entries(columnFilters).filter(([id]) => visible.includes(id as ColumnId))) : {}, [columnFiltersOn, columnFilters, visible]);
  const filtered = useMemo(() => sortHistory(filterHistory(trades, filters, activeColumnFilters), sorts), [trades, filters, activeColumnFilters, sorts]);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [filters, activeColumnFilters, sorts, pageSize]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageTrades = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedTrades = filtered.filter(t => selected.has(t.id));
  const exportable = selectedTrades.length ? selectedTrades : filtered;
  const allChecked = pageTrades.length > 0 && pageTrades.every(t => selected.has(t.id));
  const active = isFiltersActive(filters) || Object.values(activeColumnFilters).some(Boolean);
  const toggle = (set: Set<string>, id: string) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };
  function sortBy(column: ColumnId, additive: boolean) {
    const existing = sorts.find(s => s.column === column);
    const next: Sort = { column, direction: existing?.direction === 'asc' ? 'desc' : 'asc' };
    setSorts(additive ? [...sorts.filter(s => s.column !== column), next] : [next]);
  }
  function moveColumn(from: ColumnId, to: ColumnId) {
    if (from === to || !order.includes(from)) return;
    const next = order.filter(id => id !== from); next.splice(order.indexOf(to), 0, from); setOrder(next);
  }
  function resetView() { setOrder(COLUMNS.map(([id]) => id)); setVisible(DEFAULT_COLUMNS); setSorts(DEFAULT_SORT); setHeight('Default'); setPageSize(15); setColumnFiltersOn(false); setColumnFilters({}); }
  async function download(kind: 'xlsx' | 'csv') {
    setExporting(true);
    try {
      const rows = exportHistoryRows(exportable, columns);
      let blob: Blob;
      if (kind === 'xlsx') {
        const XLSX = await import('xlsx');
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = columns.map(id => ({ wch: id === 'openClose' || id === 'notes' ? 42 : 19 }));
        const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Trade History');
        blob = new Blob([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } else blob = new Blob([historyCsv(rows)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `trade-history-${new Date().toISOString().slice(0, 10)}.${kind}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setExportOpen(false);
    } catch { toast.error('Could not export trades. Please try again.'); }
    finally { setExporting(false); }
  }
  const actions = (t: Trade) => <div className="th-row-actions"><button aria-label="Edit Trade" onClick={() => onEdit(t)}><Pencil size={16} /></button><button aria-label="Share Trade" onClick={() => onShare(t)}><Share2 size={16} /></button><button aria-label="Delete Trade" className="th-loss" onClick={() => onDelete(t.id)}><Trash2 size={16} /></button></div>;
  return <section className={`surface-card p-4 sm:p-6 th-history th-height-${height.toLowerCase()}`} aria-label="Trade History">
    <div className="th-toolbar"><div className="th-title"><h3 className="text-base sm:text-[18px] font-bold text-foreground tracking-tight">Trade History</h3><span aria-live="polite" data-testid="history-count">{pageTrades.length} of {trades.length} trades</span></div>
      <div className="th-toolbar-buttons">
        <button className="th-button" data-active={showFilters || active} aria-expanded={showFilters} aria-controls="trade-history-filters" onClick={() => setShowFilters(!showFilters)}><Filter size={18} />Filters{active && <i className="th-dot" />}</button>
        <Popover><PopoverTrigger asChild><button className="th-button"><SlidersHorizontal size={18} />View</button></PopoverTrigger>
          <PopoverContent align="end" sideOffset={9} collisionPadding={12} className="th-view th-popover p-0" data-mobile-tab={mobileViewTab} aria-label="Trade history view">
            <div className="th-mobile-view-header">
              <div className="th-mobile-view-tabs" aria-label="View settings sections">
                <button aria-pressed={mobileViewTab === 'display'} onClick={() => setMobileViewTab('display')}>Display</button>
                <button aria-pressed={mobileViewTab === 'columns'} onClick={() => setMobileViewTab('columns')}>Columns</button>
              </div>
              <PopoverClose className="th-popover-close" aria-label="Close view settings"><X size={18} /></PopoverClose>
            </div>
            <div className="th-view-body"><div className="th-columns"><div className="th-columns-heading"><span className="th-label">Columns · {columns.length} of {COLUMNS.length}</span><button className="th-text-button" onClick={() => setVisible(order)}>Show all</button></div>
              {order.map((id, index) => <div className="th-column-option" key={id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); moveColumn(e.dataTransfer.getData('text/plain') as ColumnId, id); }}>
                <GripVertical size={16} className="th-grip" /><label><input type="checkbox" checked={visible.includes(id)} onChange={() => setVisible(visible.includes(id) ? visible.filter(c => c !== id) : [...visible, id])} />{labelFor(id)}</label>
                <div className="th-order-buttons"><button aria-label={`Move ${labelFor(id)} up`} disabled={index === 0} onClick={() => moveColumn(id, order[index - 1])}><ArrowUp size={12} /></button><button aria-label={`Move ${labelFor(id)} down`} disabled={index === order.length - 1} onClick={() => moveColumn(id, order[index + 1])}><ArrowDown size={12} /></button></div>
              </div>)}
            </div><div className="th-view-settings"><div className="th-view-section"><div className="th-label">Sort</div><p className="th-help">Newest trades first. Click a column header to sort, Shift+click to add another.</p>
              <label className="sr-only" htmlFor="th-sort">Sort by</label><select id="th-sort" value={sorts.length === 1 ? `${sorts[0].column}:${sorts[0].direction}` : 'multiple'} onChange={e => { const [column, direction] = e.target.value.split(':'); setSorts([{ column: column as ColumnId, direction: direction as Sort['direction'] }]); }}>
                <option value="close_time:desc">Newest trades first</option>{sorts.length > 1 && <option value="multiple">Multiple columns</option>}{COLUMNS.flatMap(([id, label]) => (['asc', 'desc'] as const).filter(d => !(id === 'close_time' && d === 'desc')).map(d => <option value={`${id}:${d}`} key={`${id}:${d}`}>{label} · {d === 'asc' ? 'Ascending' : 'Descending'}</option>))}
              </select>
            </div><div className="th-view-section"><div className="th-label">Display</div><div className="th-setting-label">Row height</div><div className="th-segment">{['Compact', 'Default', 'Relaxed'].map(h => <button key={h} aria-pressed={height === h} onClick={() => setHeight(h)}>{h}</button>)}</div>
              <div className="th-setting-label">Trades per page</div><div className="th-segment">{[10, 15, 25, 50, 100].map(n => <button key={n} aria-pressed={pageSize === n} onClick={() => setPageSize(n)}>{n}</button>)}</div>
              <label className="th-switch-label">Filter under each column<button className="th-switch" role="switch" aria-label="Filter under each column" aria-checked={columnFiltersOn} onClick={() => setColumnFiltersOn(!columnFiltersOn)}><span /></button></label>
            </div><div className="th-view-section"><div className="th-label">Tips</div><p className="th-help">Drag a column or use its arrows to reorder it. Click column headers to sort. Exports use your current filters, sort and visible columns.</p></div></div></div>
            <div className="th-view-footer"><span>View applies to this session</span><button onClick={resetView}><RotateCcw size={14} />Reset view</button></div>
          </PopoverContent>
        </Popover>
        <Popover open={exportOpen} onOpenChange={setExportOpen}><PopoverTrigger asChild><button className="th-button"><Download size={18} />Export</button></PopoverTrigger>
          <PopoverContent align="end" sideOffset={9} collisionPadding={12} className="th-export th-popover p-0" aria-label="Export trade history">
            <div className="th-export-options">{(['xlsx', 'csv'] as const).map(kind => <button key={kind} disabled={exporting || !columns.length || !exportable.length} onClick={() => download(kind)}>{kind === 'xlsx' ? <FileSpreadsheet size={18} /> : <FileText size={18} />}<strong>{kind === 'xlsx' ? 'Excel workbook' : 'CSV file'}</strong><span>{exportable.length} trades</span></button>)}</div>
            <p className="th-help">Uses your current filters, sort and visible columns. Tick rows in the table to export only those.{!columns.length && ' Show a column to export.'}</p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    {showFilters && <TradeHistoryFilters filters={filters} onChange={setFilters} profitable={trades.filter(t => Number(t.pnl) > 0).length} losses={trades.filter(t => Number(t.pnl) < 0).length} onClear={() => setColumnFilters({})} />}
    <div className="th-mobile-history">
      {columnFiltersOn && <div className="th-mobile-column-filters" aria-label="Column filters">
        {columns.map(id => <label key={id}>{labelFor(id)}<input aria-label={`Filter ${labelFor(id)}`} placeholder="Filter…" value={columnFilters[id] || ''} onChange={e => setColumnFilters({ ...columnFilters, [id]: e.target.value })} /></label>)}
      </div>}
      {pageTrades.map(t => <article className="th-mobile-card" key={t.id} data-selected={selected.has(t.id)}>
        <button className="th-mobile-summary" aria-label={`Trade details for ${t.symbol} ${formatHistoryDate(t.close_time)}`} aria-expanded={expanded.has(t.id)} aria-controls={`trade-details-${t.id}`} onClick={() => setExpanded(toggle(expanded, t.id))}>
          <span className="th-mobile-summary-values">
            {summaryColumns.map(id => <span key={id} className={`th-mobile-summary-${id}`}><Cell trade={t} column={id} /></span>)}
            {!summaryColumns.length && <span>Trade details</span>}
          </span>
          <ChevronDown size={16} className="th-mobile-chevron" />
        </button>
        {expanded.has(t.id) && <div className="th-mobile-details" id={`trade-details-${t.id}`}>
          <dl className="th-mobile-fields">
            {columns.map(id => <div key={id} className={id === 'openClose' || id === 'notes' ? 'th-mobile-field-wide' : ''}><dt>{labelFor(id)}</dt><dd><Cell trade={t} column={id} /></dd></div>)}
          </dl>
          <div className="th-mobile-card-footer">
            <label><input type="checkbox" aria-label={`Select trade ${t.id}`} checked={selected.has(t.id)} onChange={() => setSelected(toggle(selected, t.id))} />Select for export</label>
            {actions(t)}
          </div>
        </div>}
      </article>)}
      {!pageTrades.length && <div className="th-empty"><Activity size={40} /><p>{trades.length ? 'No trades match the selected filters.' : 'No trades yet. Click "+ Add Trade" to get started.'}</p></div>}
    </div>
    <div className="th-table-scroll"><table className="th-table"><thead><tr><th className="th-select-cell"><input type="checkbox" aria-label="Select all trades on this page" checked={allChecked} ref={el => { if (el) el.indeterminate = !allChecked && pageTrades.some(t => selected.has(t.id)); }} onChange={() => { const next = new Set(selected); pageTrades.forEach(t => allChecked ? next.delete(t.id) : next.add(t.id)); setSelected(next); }} /></th>
      {columns.map(id => <th key={id} aria-sort={sorts[0]?.column === id ? sorts[0].direction === 'asc' ? 'ascending' : 'descending' : 'none'} draggable onDragStart={e => e.dataTransfer.setData('text/plain', id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); moveColumn(e.dataTransfer.getData('text/plain') as ColumnId, id); }}><button onClick={e => sortBy(id, e.shiftKey)}>{labelFor(id)}{sorts.some(s => s.column === id) && (sorts.find(s => s.column === id)!.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button></th>)}<th><span className="sr-only">Actions</span></th></tr>
      {columnFiltersOn && <tr className="th-column-filters"><th />{columns.map(id => <th key={id}><input aria-label={`Filter ${labelFor(id)}`} placeholder="Filter…" value={columnFilters[id] || ''} onChange={e => setColumnFilters({ ...columnFilters, [id]: e.target.value })} /></th>)}<th /></tr>}
    </thead><tbody>
      {pageTrades.map(t => <Fragment key={t.id}><tr className="th-trade-row"><td className="th-select-cell"><div><input aria-label={`Select trade ${t.id}`} type="checkbox" checked={selected.has(t.id)} onChange={() => setSelected(toggle(selected, t.id))} /><button aria-label={`Executions for ${t.symbol} ${formatHistoryDate(t.close_time)}`} aria-expanded={expanded.has(t.id)} onClick={() => setExpanded(toggle(expanded, t.id))}>{expanded.has(t.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></div></td>{columns.map(id => <td key={id}><Cell trade={t} column={id} /></td>)}<td>{actions(t)}</td></tr>
        {expanded.has(t.id) && <tr><td colSpan={columns.length + 2} className="th-executions-cell"><div className="th-executions"><div className="th-label">Executions</div><table><thead><tr>{['Action', 'Side', 'Time', 'Price', 'Volume', 'Commission', 'Swap', 'P&L'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{['Open', 'Close'].map(action => <tr key={action}><td><span className={action === 'Open' ? 'th-profit' : ''}>{action}</span></td><td>{(action === 'Open') === (t.direction === 'Long') ? 'Buy' : 'Sell'}</td><td>{formatHistoryDate(action === 'Open' ? t.open_time : t.close_time)}</td><td>{money(action === 'Open' ? t.entry_price : t.exit_price)}</td><td>{t.lot_size}</td><td>{action === 'Open' ? '—' : columnText(t, 'commission')}</td><td>{action === 'Open' ? '—' : columnText(t, 'swap')}</td><td>{action === 'Open' ? '—' : <Cell trade={t} column="pnl" />}</td></tr>)}</tbody></table></div></td></tr>}
      </Fragment>)}
      {!pageTrades.length && <tr><td colSpan={columns.length + 2} className="th-empty"><Activity size={40} /><p>{trades.length ? 'No trades match the selected filters.' : 'No trades yet. Click "+ Add Trade" to get started.'}</p></td></tr>}
    </tbody></table></div>
    <div className="th-pagination"><span aria-live="polite">{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} matching trades` : '0 matching trades'}{selectedTrades.length > 0 && ` · ${selectedTrades.length} selected`}</span><div><button className="th-button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="th-button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
  </section>;
}
