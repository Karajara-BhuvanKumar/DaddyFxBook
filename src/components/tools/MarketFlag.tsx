import { useId } from 'react';
import type { MarketSessionId } from '@/lib/forexMarketHours';

// Vector flags also render on Windows, where flag emoji may appear as letters.
export default function MarketFlag({ market }: { market: MarketSessionId }) {
  const clip = useId();
  const union = <><path d="M0 0 32 32M32 0 0 32" stroke="white" strokeWidth="7" /><path d="M0 0 32 32M32 0 0 32" stroke="#d92235" strokeWidth="3" /><path d="M16 0V32M0 16H32" stroke="white" strokeWidth="11" /><path d="M16 0V32M0 16H32" stroke="#d92235" strokeWidth="6" /></>;
  return <svg className="fx-flag" viewBox="0 0 32 32" aria-hidden="true"><defs><clipPath id={clip}><circle cx="16" cy="16" r="15" /></clipPath></defs><g clipPath={`url(#${clip})`}>
    <rect width="32" height="32" fill={market === 'tokyo' || market === 'new-york' ? 'white' : '#12317b'} />
    {market === 'tokyo' && <circle cx="16" cy="16" r="8.5" fill="#d81735" />}
    {market === 'london' && union}
    {market === 'sydney' && <><g transform="scale(.53)">{union}</g>{[[9, 24], [25, 10], [21, 19], [26, 26]].map(([x, y]) => <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d="M0-3 1-1 3-1 1.5 1 2 3 0 1.8-2 3-1.5 1-3-1-1-1Z" fill="white" />)}</>}
    {market === 'new-york' && <>{Array.from({ length: 7 }, (_, i) => <rect key={i} x="0" y={i * 32 / 6.5} width="32" height={32 / 13} fill="#db2941" />)}<rect width="17" height="17" fill="#253975" />{Array.from({ length: 16 }, (_, i) => <circle key={i} cx={2 + i % 4 * 4} cy={2 + Math.floor(i / 4) * 4} r=".8" fill="white" />)}</>}
  </g></svg>;
}
