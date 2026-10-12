import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { Clock3, Moon, Star, Sun } from 'lucide-react';
import { useWorkspacePreferences } from '@/contexts/WorkspacePreferencesContext';
import { activitySeries, buildForexSchedule, forexMarketHours, timelineBounds } from '@/lib/forexMarketHours';
import { formatCountdown, formatMarketDate, formatMarketTime, marketZoneInfo, zonedDateKey, zonedParts, type TimeFormat } from '@/lib/marketTime';
import '@/styles/forex-market-hours.css';
import MarketFlag from './MarketFlag';

export default function ForexMarketHours() {
  const { preferences } = useWorkspacePreferences();
  const zone = preferences.timezone;
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(preferences.time_format === '12h' ? '12h' : '24h');
  const [now, setNow] = useState(() => new Date());
  const gradientId = useId();
  useEffect(() => { setTimeFormat(preferences.time_format === '12h' ? '12h' : '24h'); }, [preferences.time_format]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    // Read the real clock on every tick; never accumulate elapsed intervals.
    // Subsecond updates move the marker smoothly without drifting after sleep.
    const timer = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, []);

  const rangeStart = timelineBounds(now, zone, 6).start;
  const schedule = useMemo(() => buildForexSchedule(new Date(rangeStart), zone, 6), [rangeStart, zone]);
  const series = useMemo(() => activitySeries(schedule), [schedule]);
  const { sessions, isOpen, progress, durationMinutes, bounds, ticks, bestTimes, activity } = forexMarketHours(now, zone, schedule);
  const active = sessions.filter(session => session.active);
  const userZone = marketZoneInfo(now, zone);
  const time = (date: Date | number, seconds = false) => formatMarketTime(date, zone, timeFormat, seconds);
  const range = (start: number, end: number) => `${time(start)} – ${time(end)}`;
  const stamp = (instant: number) => `${formatMarketDate(instant, zone)}, ${time(instant)} ${marketZoneInfo(instant, zone).abbreviation}`;
  const y = (score: number) => 90 - score * 23;
  const line = series.map((point, index) => `${index ? 'L' : 'M'} ${point.progress * 10} ${y(point.before)} L ${point.progress * 10} ${y(point.score)}`).join(' ');

  return <section className="fx-dashboard" aria-label={`Forex market sessions · ${zone}`}>
    <div className="tools-heading fx-heading">
      <div className="tools-heading-copy"><span className="tool-icon"><Clock3 /></span><div><h2>Forex Market Hours</h2><p>Track trading sessions across the globe in real time</p></div></div>
      <div className="fx-clock-controls"><div className="fx-format"><span className={timeFormat === '12h' ? 'selected' : ''}>12h</span><button type="button" role="switch" aria-label="Use 24-hour time" aria-checked={timeFormat === '24h'} onClick={() => setTimeFormat(value => value === '24h' ? '12h' : '24h')}><i /></button><span className={timeFormat === '24h' ? 'selected' : ''}>24h</span></div><div className="fx-user-clock"><Clock3 aria-hidden="true" /><div><time data-testid="market-user-clock" dateTime={now.toISOString()}>{time(now, true)}</time><span>{formatMarketDate(now, zone)} · {userZone.abbreviation}</span></div></div></div>
    </div>
    <p className="fx-display-zone">Timeline & trading windows: <strong>{zone} · {userZone.abbreviation} ({userZone.offset})</strong><span>Market clocks below show each city’s local time.</span></p>
    <div className="tool-market fx-market">
      <div className="fx-timeline" style={{ '--now-progress': `${progress}%` } as CSSProperties}>
        <div className="fx-timeline-overlay" aria-hidden="true"><i className="fx-now-line" /></div>
        <div className="fx-axis-row">
          <div className="fx-session-status" aria-live="polite"><span className={`tool-badge ${isOpen ? 'is-live' : ''}`}>{active.length ? `${active.map(s => s.name).join(' + ')} active` : isOpen ? 'Between major sessions' : 'Weekend · Market closed'}</span></div>
          <div className="fx-axis">
            <div className="fx-daylight" aria-hidden="true">{ticks.slice(0, -1).map((tick, index) => {
              const hour = zonedParts(tick.at, zone).hour;
              return <span key={tick.at} className={hour < 6 || hour >= 18 ? 'night' : 'day'} style={{ left: `${tick.progress}%`, width: `${ticks[index + 1].progress - tick.progress}%` }}>{hour === 6 ? <Sun size={14} /> : hour === 18 ? <Moon size={14} /> : null}</span>;
            })}</div>
            <div className="tool-market-axis">{ticks.map((tick, index) => <span key={tick.at} className={`${index % 3 === 0 && index < ticks.length - 2 ? 'medium' : ''} ${index % 6 === 0 && index < ticks.length - 3 ? 'major' : ''} ${index === ticks.length - 1 ? 'last' : ''} ${index === 1 || index === ticks.length - 2 ? 'edge-neighbor' : ''}`} style={{ left: `${tick.progress}%`, transform: index === 0 ? 'none' : index === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }} title={stamp(tick.at)}>{timeFormat === '12h' ? time(tick.at).replace(':00', '').replace(' ', '') : time(tick.at)}</span>)}</div>
          </div>
        </div>
        {sessions.map(session => {
          const localZone = marketZoneInfo(now, session.zone);
          const boundary = session.current?.end ?? session.next.start;
          const boundaryLabel = session.active ? 'Closes' : 'Opens';
          const visibleIntervals = session.intervals.filter(i => i.start < bounds.end && i.end > bounds.start);
          return <div key={session.id} data-market={session.id} className={`fx-session tool-session-row fx-${session.id} ${session.active ? 'is-active' : ''}`} aria-current={session.active ? 'time' : undefined}>
            <div className="fx-local-clock"><MarketFlag market={session.id} /><div><h3>{session.name}</h3><time data-testid={`${session.id}-clock`} dateTime={now.toISOString()}>{formatMarketTime(now, session.zone, timeFormat, true)}</time><p>{formatMarketDate(now, session.zone)}</p><span title={localZone.name} data-testid={`${session.id}-zone`}>{localZone.abbreviation} ({localZone.offset})</span></div></div>
            <div className="fx-session-track"><div className="fx-lane-caption"><strong>{session.name} session {session.active ? 'open' : 'closed'}</strong><span data-testid={`${session.id}-countdown`}>{boundaryLabel} in {formatCountdown(boundary - now.getTime())}</span></div>
              <div className="tool-session-lane" role="img" aria-label={`${session.name} sessions on this timeline: ${visibleIntervals.length ? visibleIntervals.map(i => `${stamp(i.start)} to ${stamp(i.end)}`).join('; ') : 'none'}${session.active ? ', active now' : ''}`}>
                {session.segments.map((part, index) => <span key={part.start} className="tool-session-bar" title={`${stamp(visibleIntervals[index].start)} – ${stamp(visibleIntervals[index].end)}`} style={{ left: `${part.start / durationMinutes * 100}%`, width: `${(part.end - part.start) / durationMinutes * 100}%` }} />)}
                <i className="tool-session-now" style={{ left: `${progress}%` }} aria-hidden="true" />
              </div>
              <div className="fx-session-next"><span>{session.active ? 'Current session' : 'Next session'}: {range((session.current ?? session.next).start, (session.current ?? session.next).end)} {marketZoneInfo((session.current ?? session.next).start, zone).abbreviation}{zonedDateKey((session.current ?? session.next).start, zone) !== zonedDateKey((session.current ?? session.next).end, zone) ? ' · ends next day' : ''}</span><span>{boundaryLabel} {stamp(boundary)}</span></div>
            </div>
          </div>;
        })}
        <div className="fx-volume-row"><div><p>Typical trading activity</p><span className={`tool-badge fx-activity-${activity.label.toLowerCase()}`}>{activity.label}</span><small>Session-based volume estimate</small></div><div className="fx-volume-chart"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label={`Relative session activity chart. Currently ${activity.label.toLowerCase()}. This is not live market volume.`}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--shell-blue)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--shell-blue)" stopOpacity="0" /></linearGradient></defs><path d={`${line} L 1000 100 L 0 100 Z`} fill={`url(#${gradientId})`} /><path d={line} fill="none" stroke="var(--shell-blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><i className="fx-volume-dot" style={{ left: `${progress}%`, top: `${y(activity.score)}%` }} /><span className="fx-now-label" style={{ left: `${progress}%`, transform: progress < 10 ? 'none' : progress > 90 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{time(now)}</span></div></div>
      </div>
      <div className="fx-timeline-note"><span>{formatMarketDate(bounds.start, zone)}, {time(bounds.start)} → {formatMarketDate(bounds.end, zone)}, {time(bounds.end)}</span><span>{durationMinutes / 60}-hour timeline · {zone} · bars show overlaps</span></div>
    </div>
    <section className="fx-best-times" aria-labelledby="best-times-heading"><h3 id="best-times-heading"><Star />Best Times to Trade</h3><div className="fx-best-grid">{bestTimes.map(window => <article key={window.id} data-window={window.id} className={`fx-best-card fx-${window.id}`}><div><span className="tool-badge">{window.label}</span><span>{window.title}</span></div><h4>{range(window.start, window.end)}</h4><p className="fx-window-date">{formatMarketDate(window.start, zone)} · {marketZoneInfo(window.start, zone).abbreviation} ({marketZoneInfo(window.start, zone).offset}){zonedDateKey(window.start, zone) !== zonedDateKey(window.end, zone) && ` → ${formatMarketDate(window.end, zone)}`}</p><p>{window.description}</p><small>{window.active ? 'Active · ends' : 'Next window · starts'} in {formatCountdown((window.active ? window.end : window.start) - now.getTime())}</small></article>)}</div></section>
    <p className="tool-hint fx-footnote">Local clocks use each city’s current timezone rules. Session bars and trading windows follow your saved timezone; the 12h/24h switch changes this view. Typical forex sessions include weekend closures; holidays and broker breaks may differ. The activity chart reflects scheduled sessions, not live traded volume.</p>
  </section>;
}
