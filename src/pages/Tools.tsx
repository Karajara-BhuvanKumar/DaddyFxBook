import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calculator, Clock3, Wrench } from 'lucide-react';
import PositionSizeCalculator from '@/components/tools/PositionSizeCalculator';
import ForexMarketHours from '@/components/tools/ForexMarketHours';
import NotFound from '@/pages/NotFound';
import '@/styles/tools.css';

const availableTools = [
  { slug: 'position-size-calculator', title: 'Position Size Calculator', description: 'Calculate optimal lot size based on your risk tolerance and stop-loss distance', badge: 'Popular', icon: Calculator },
  { slug: 'forex-market-hours', title: 'Forex Market Hours', description: 'Track real-time trading sessions and see when forex markets overlap', badge: 'Live', icon: Clock3 },
];

export default function Tools() {
  const { pathname } = useLocation();
  const base = pathname.startsWith('/preview/') ? '/preview/tools' : '/tools';
  const slug = pathname.slice(base.length).replace(/^\/|\/$/g, '');
  const selected = availableTools.find(tool => tool.slug === slug);
  if (slug && !selected) return <NotFound />;
  const Icon = selected?.icon ?? Wrench;
  return <div className={`tools-page ${selected ? 'tool-detail-page' : ''}`}>
    {selected && <Link className="tool-back" to={base}><ArrowLeft size={16} />Back to Tools</Link>}
    {selected?.slug !== 'forex-market-hours' && <div className="tools-heading"><div className="tools-heading-copy"><span className="tool-icon"><Icon /></span><div><h2>{selected?.title ?? 'Trading Tools'}</h2><p>{selected ? selected.description : 'Professional calculators and utilities to enhance your trading workflow'}</p></div></div>{!selected && <div className="tools-counts"><div><strong>{availableTools.length}</strong><span>Available</span></div><div><strong>0</strong><span>Coming soon</span></div></div>}</div>}
    {!selected ? <div className="tools-grid">{availableTools.map(({ slug, title, description, badge, icon: CardIcon }) => <Link key={slug} to={`${base}/${slug}`} className="tool-card" aria-label={`Open ${title}`}><div className="tool-card-top"><span className="tool-icon"><CardIcon /></span><span className="tool-badge">{badge}</span></div><h3>{title}</h3><p>{description}</p><span className="tool-card-action">Open Tool<ArrowRight size={19} /></span></Link>)}</div> : selected.slug === 'position-size-calculator' ? <PositionSizeCalculator /> : <ForexMarketHours />}
  </div>;
}
