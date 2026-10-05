import { memo, useEffect, useState } from 'react';
import { utcSession } from '@/lib/analysisStats';

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
  const { progress, segment, name } = utcSession(clock);
  const time = clock.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' });
  return <div className="an-session-timeline" aria-label={`Current session: ${name}`}>
    <div className="an-session-track">{['Asian', 'London', 'New York', 'Asian'].map((label, index) => <span key={index} aria-current={segment === index ? 'time' : undefined} aria-label={index === 3 ? 'Asian session continues' : undefined}>{index < 3 ? label : null}</span>)}</div>
    <div className="an-now" style={{ left: `${progress}%` }} title={`${time} IST · ${name}`}><span style={{ transform: progress < 5 ? 'none' : progress > 95 ? 'translateX(-100%)' : 'translateX(-50%)' }}>NOW</span></div>
    <div className="an-session-times"><span>05:30</span><span>13:30</span><span>18:30</span><span title="03:30 IST, next day">03:30</span><span title="05:30 IST, next day">05:30</span></div>
  </div>;
});
