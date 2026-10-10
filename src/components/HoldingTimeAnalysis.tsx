import { useState } from 'react';
import { Clock } from 'lucide-react';
import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { type analyzeHoldingTime } from '@/lib/analysisStats';
import { formatHoldingDuration, formatTradeDateTime } from '@/lib/holdingTime';

const money = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function HoldingTimeAnalysis({ data }: { data: ReturnType<typeof analyzeHoldingTime> }) {
  const [metric, setMetric] = useState<'averagePnl' | 'pnl'>('averagePnl');
  const stats = [
    ['Average holding time', data.average], ['Median holding time', data.median],
    ['Longest-held trade', data.longest?.duration], ['Shortest-held trade', data.shortest?.duration],
    ['Total time in trades', data.total], ['Winning trades · average', data.winningAverage], ['Losing trades · average', data.losingAverage],
  ] as const;
  return <section className="an-surface an-holding" aria-label="Holding Time">
    <div className="an-section-heading"><div><h2><Clock />Holding Time</h2><p>{data.count} completed trades · uses the page’s period and outcome filters</p></div></div>
    <dl className="an-holding-stats">{stats.map(([label, value]) => {
      const record = label === 'Longest-held trade' ? data.longest : label === 'Shortest-held trade' ? data.shortest : null;
      return <div key={label}><dt className="an-label">{label}</dt><dd>{formatHoldingDuration(value)}</dd>{record && <small title={`Trade ${record.trade.id}`}>{record.trade.symbol} · {formatTradeDateTime(record.trade.open_time)} · {money(record.trade.pnl)}</small>}{label.startsWith('Winning') && <small>{data.wins} trades</small>}{label.startsWith('Losing') && <small>{data.losses} trades</small>}</div>;
    })}</dl>
    <p className="an-holding-note">Total time adds each trade’s duration, including overlapping trades. Missing, open, or invalid records are excluded. Durations are displayed to whole minutes; calculations use exact timestamps.</p>
    {data.count ? <>
      <div className="an-section-heading"><h3>Performance by holding range</h3><div className="an-segments" role="group" aria-label="Holding range chart metric"><button aria-pressed={metric === 'averagePnl'} onClick={() => setMetric('averagePnl')}>Average P&amp;L</button><button aria-pressed={metric === 'pnl'} onClick={() => setMetric('pnl')}>Total P&amp;L</button></div></div>
      <div className="an-holding-chart" role="img" aria-label={`${metric === 'pnl' ? 'Total' : 'Average'} P&L by holding range; exact values in the following table`}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data.ranges} margin={{ top: 10, right: 12, bottom: 5, left: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="short" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><YAxis width={66} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted) / .4)' }} content={({ active, payload }) => active && payload?.[0] ? <div className="an-holding-tooltip"><strong>{payload[0].payload.label}</strong><p>{payload[0].payload.count} trades · {money(Number(payload[0].value))}</p></div> : null} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" /><Bar dataKey={metric} isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={64}>{data.ranges.map(r => <Cell key={r.label} fill={r.pnl < 0 ? 'hsl(var(--loss))' : 'hsl(var(--profit))'} />)}</Bar>
        </BarChart></ResponsiveContainer>
      </div>
      <div className="an-holding-table-scroll"><table className="an-holding-table"><caption className="sr-only">Trade counts and performance by holding duration</caption><thead><tr>{['Holding range', 'Trades', 'Win rate', 'Total P&L', 'Avg P&L'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{data.ranges.map(r => <tr key={r.label}><th scope="row">{r.label}{r.count > 0 && r.count < 5 && <small>Small sample</small>}</th><td>{r.count}</td><td>{r.winRate === null ? '—' : `${r.winRate.toFixed(1)}%`}</td><td className={r.pnl < 0 ? 'an-loss' : r.pnl > 0 ? 'an-profit' : ''}>{r.count ? money(r.pnl) : '—'}</td><td>{r.averagePnl === null ? '—' : money(r.averagePnl)}</td></tr>)}</tbody></table></div>
      <p className="an-holding-note">Ranges include their lower bound and exclude their upper bound. Win rate excludes break-even trades, matching the rest of Analysis. Small samples (fewer than 5 trades) may be unrepresentative.</p>
    </> : <p className="an-inline-empty">No completed trades with valid opening and closing timestamps in this selection.</p>}
  </section>;
}
