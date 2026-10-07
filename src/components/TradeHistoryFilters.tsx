import { CalendarDays, FolderPlus, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import { COLUMNS, PERIODS, DEFAULT_FILTERS, type Condition, type HistoryFilters } from '@/lib/tradeHistory';

const newRule = (): Condition => ({ id: crypto.randomUUID(), field: 'symbol', operator: 'contains', value: '' });
function Rule({ rule, change, remove }: { rule: Condition; change: (rule: Condition) => void; remove: () => void }) {
  return <div className="th-rule">
    <select aria-label="Condition column" value={rule.field} onChange={e => change({ ...rule, field: e.target.value as Condition['field'] })}>{COLUMNS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    <select aria-label="Condition operator" value={rule.operator} onChange={e => change({ ...rule, operator: e.target.value as Condition['operator'] })}>
      <option value="contains">contains</option><option value="eq">equals</option><option value="neq">does not equal</option><option value="gt">greater than</option><option value="lt">less than</option>
    </select>
    <input aria-label="Condition value" placeholder={rule.field === 'duration' ? 'Minutes' : 'Value'} value={rule.value} onChange={e => change({ ...rule, value: e.target.value })} />
    <button aria-label="Remove condition" onClick={remove}><X size={15} /></button>
  </div>;
}
export default function TradeHistoryFilters({ filters: f, onChange, profitable, losses, onClear }: {
  filters: HistoryFilters; onChange: (f: HistoryFilters) => void; profitable: number; losses: number; onClear: () => void;
}) {
  const update = (patch: Partial<HistoryFilters>) => onChange({ ...f, ...patch });
  return <div className="th-filters" id="trade-history-filters">
    <div className="th-filter-top">
      <div><div className="th-label">P&amp;L</div><div className="th-pills">{(['All', 'Profitable', 'Loss'] as const).map(p => <button key={p} aria-pressed={f.pnl === p} onClick={() => update({ pnl: p })}>{p}{p !== 'All' && ` (${p === 'Profitable' ? profitable : losses})`}</button>)}</div></div>
      <div><div className="th-label">Type</div><div className="th-pills">{(['All', 'Long', 'Short'] as const).map(d => <button key={d} aria-pressed={f.direction === d} onClick={() => update({ direction: d })}>{d === 'Long' && <TrendingUp size={16} />}{d === 'Short' && <TrendingDown size={16} />}{d}</button>)}</div></div>
    </div>
    <div><div className="th-label">Time period</div><div className="th-pills">{PERIODS.map(period => <button key={period} aria-pressed={f.period === period} onClick={() => update({ period })}>{period === 'Custom' && <CalendarDays size={16} />}{period}</button>)}</div></div>
    {f.period === 'Custom' && <div><div className="th-custom"><label>Start date<input type="date" value={f.start} max={f.end || undefined} onChange={e => update({ start: e.target.value })} /></label><label>End date<input type="date" value={f.end} min={f.start || undefined} onChange={e => update({ end: e.target.value })} /></label></div>{f.start && f.end && f.start > f.end && <p role="alert" className="text-loss text-sm mt-2">Start date must be on or before end date.</p>}</div>}
    <div><div className="th-label">Conditions</div>
      {f.rules.map(rule => <Rule key={rule.id} rule={rule} change={next => update({ rules: f.rules.map(r => r.id === next.id ? next : r) })} remove={() => update({ rules: f.rules.filter(r => r.id !== rule.id) })} />)}
      {f.groups.map(group => <div className="th-condition-group" key={group.id}>
        <div className="th-group-heading"><span>Match <select aria-label="Group match" value={group.match} onChange={e => update({ groups: f.groups.map(g => g.id === group.id ? { ...g, match: e.target.value as 'all' | 'any' } : g) })}><option value="all">all</option><option value="any">any</option></select> conditions</span><button aria-label="Remove group" onClick={() => update({ groups: f.groups.filter(g => g.id !== group.id) })}><X size={15} /></button></div>
        {group.rules.map(rule => <Rule key={rule.id} rule={rule} change={next => update({ groups: f.groups.map(g => g.id === group.id ? { ...g, rules: g.rules.map(r => r.id === next.id ? next : r) } : g) })} remove={() => update({ groups: f.groups.map(g => g.id === group.id ? { ...g, rules: g.rules.filter(r => r.id !== rule.id) } : g) })} />)}
        <button className="th-text-button" onClick={() => update({ groups: f.groups.map(g => g.id === group.id ? { ...g, rules: [...g.rules, newRule()] } : g) })}><Plus size={16} />Add condition to group</button>
      </div>)}
      <div className="th-condition-actions"><button className="th-text-button" onClick={() => update({ rules: [...f.rules, newRule()] })}><Plus size={16} />Add condition</button><button className="th-text-button muted" onClick={() => update({ groups: [...f.groups, { id: crypto.randomUUID(), match: 'all', rules: [newRule()] }] })}><FolderPlus size={16} />Add group</button></div>
      {!!(f.rules.length || f.groups.length) && <p className="th-help">All conditions and groups must match. Empty conditions are ignored. Dates use close time; durations use minutes.</p>}
    </div>
    <div className="th-filter-footer"><button className="th-button" onClick={() => { onChange(DEFAULT_FILTERS); onClear(); }}><X size={16} />Clear All Filters</button></div>
  </div>;
}
