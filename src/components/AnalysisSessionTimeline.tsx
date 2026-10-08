import { memo, useEffect, useState } from 'react';
import { IST_MARKET_SESSIONS, IST_TIMELINE_TICKS, istSessionClock, sessionSegments } from '@/lib/marketSessions';

export const AnalysisSessionTimeline = memo(function AnalysisSessionTimeline() {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      setClock(new Date());
      timer = setTimeout(tick, 1000 - Date.now() % 1000);
    };
    tick();
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const { progress, active, time, date } = istSessionClock(clock);
  const names = active.map(s => s.name).join(' + ');
  const markerStyle = { left: `${progress}%` };
  return <div className="an-session-timeline" aria-label={`IST market sessions. Active: ${names}`}>
    <div className="an-clock-summary">
      <div className="an-clock-time"><time dateTime={clock.toISOString()}>{time}<span>IST</span></time><span>{date}</span></div>
      <div className="an-active-markets"><span className="an-clock-eyebrow">Active now</span><div aria-live="polite" aria-atomic="true">{active.map(s => <span key={s.id} className={`an-market-badge an-market-${s.id}`}><i />{s.name}</span>)}</div></div>
    </div>
    <div className="an-session-chart" role="group" aria-label="Today's 24-hour market timeline in IST">
      <div className="an-session-times" aria-hidden="true">{IST_TIMELINE_TICKS.map(tick => <span key={tick.label}
        className={`${'major' in tick ? 'is-major' : ''} ${'mobileOnly' in tick ? 'is-mobile-only' : ''} ${'lower' in tick ? 'is-lower' : ''}`}
        style={{ left: `${tick.minute / 1440 * 100}%`, transform: tick.minute === 0 ? 'none' : tick.minute === 1440 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{tick.label}</span>)}</div>
      <div className="an-market-lanes">
        <div className="an-now" style={markerStyle} title={`${time} IST · ${names}`} aria-label={`Now ${time} IST`}><span style={{ transform: progress < 7 ? 'none' : progress > 93 ? 'translateX(-100%)' : 'translateX(-50%)' }}>NOW</span></div>
        {IST_MARKET_SESSIONS.map(session => {
          const isActive = active.some(s => s.id === session.id);
          return <div className={`an-market-row an-market-${session.id}`} key={session.id} aria-current={isActive ? 'time' : undefined}>
            <div className="an-market-caption"><strong><i />{session.name}{isActive && <span>Active</span>}</strong><span>{session.hours} IST{session.start > session.end && <small> · next day</small>}</span></div>
            <div className="an-market-lane" role="img" aria-label={`${session.name}: ${session.hours} IST${session.start > session.end ? ', ends next day' : ''}${isActive ? ', active now' : ''}`}>
              {sessionSegments(session.start, session.end).map((part, index) => <div key={part.start} className={`an-market-bar ${session.start > session.end ? index === 0 ? 'continues-before' : 'continues-after' : ''}`} style={{ left: `${part.start / 1440 * 100}%`, width: `${(part.end - part.start) / 1440 * 100}%` }} aria-hidden="true"><span>{session.start > session.end && index === 0 ? '↤' : session.name}</span></div>)}
              <div className="an-lane-now" style={markerStyle} aria-hidden="true" />
            </div>
          </div>;
        })}
      </div>
    </div>
    <div className="an-clock-note"><span>Aligned lanes show session overlaps. New York continues across midnight.</span><span>Performance uses your saved journal’s Market Session, including off-session entries under their named session.</span></div>
  </div>;
});
