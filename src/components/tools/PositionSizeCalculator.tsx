import { useState, type ReactNode } from 'react';
import { AlertTriangle, Calculator, CreditCard, Crosshair, Globe, HelpCircle, LayoutPanelLeft, RotateCcw, Shield, TrendingUp } from 'lucide-react';
import { calculatePositionSize, decimalValue, POSITION_INSTRUMENTS, validRisk } from '@/lib/positionSize';

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const preciseLots = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 8 });
const RISK_STEP = 0.25;

function Field({ id, title, icon, children }: { id: string; title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="tool-field" aria-labelledby={`${id}-label`}><label id={`${id}-label`} htmlFor={id} className="tool-label">{icon}{title}</label>{children}</section>;
}

export default function PositionSizeCalculator() {
  const [balance, setBalance] = useState('');
  const [risk, setRisk] = useState('1');
  const [stop, setStop] = useState('');
  const [symbol, setSymbol] = useState('EURUSD');
  const [custom, setCustom] = useState(false);
  const [customPip, setCustomPip] = useState('');
  const instrument = POSITION_INSTRUMENTS.find(item => item.symbol === symbol)!;
  const accountBalance = decimalValue(balance), riskPercent = validRisk(risk), stopPips = decimalValue(stop);
  const pipValue = custom ? decimalValue(customPip) : instrument.contractSize * instrument.pipSize;
  const result = accountBalance !== null && riskPercent !== null && stopPips !== null && pipValue !== null
    ? calculatePositionSize(accountBalance, riskPercent, stopPips, pipValue) : null;
  const showGoldEstimate = symbol === 'XAUUSD' && result !== null && result.lots > 0;
  const position = showGoldEstimate ? result.estimate : result;
  // Use a practical 0–10% scale, expanding for larger valid typed percentages.
  const sliderMax = Math.max(10, Math.ceil((riskPercent ?? 0) / 10) * 10);
  const setSliderRisk = (value: number) => setRisk(String(Math.max(RISK_STEP, Math.min(sliderMax, Math.round(value / RISK_STEP) * RISK_STEP))));
  const riskAmount = accountBalance !== null && riskPercent !== null ? accountBalance * (riskPercent / 100) : null;
  const reset = () => { setBalance(''); setRisk('1'); setStop(''); setSymbol('EURUSD'); setCustom(false); setCustomPip(''); };
  const inputProps = { type: 'number', inputMode: 'decimal' as const, step: 'any', min: '0' };
  return <div className="tool-calculator">
    <div className="tool-inputs">
      <Field id="account-balance" title="Account balance" icon={<CreditCard />}>
        <div className="tool-input-wrap"><span>$</span><input {...inputProps} id="account-balance" placeholder="10,000" value={balance} onChange={e => setBalance(e.target.value)} aria-invalid={balance !== '' && accountBalance === null} aria-describedby="balance-help" /><span>USD</span></div>
        <p id="balance-help" className={balance !== '' && accountBalance === null ? 'tool-error' : 'tool-hint'}>{balance !== '' && accountBalance === null ? 'Enter a balance greater than zero.' : 'Enter your trading account balance in USD.'}</p>
      </Field>
      <Field id="risk-percentage" title="Risk percentage" icon={<AlertTriangle />}>
        <div className="tool-risk-row"><div className="tool-input-wrap tool-risk-input"><input {...inputProps} id="risk-percentage" max="100" value={risk} onChange={e => setRisk(e.target.value)} aria-invalid={riskPercent === null} aria-describedby="risk-help" /><span>%</span></div><output data-testid="risk-preview" aria-label="Risk amount in USD">{riskAmount !== null && Number.isFinite(riskAmount) && riskAmount <= Number.MAX_SAFE_INTEGER / 100 ? money(riskAmount) : '—'}</output></div>
        {/* step="any" preserves off-grid typed values in the native thumb. Pointer and keyboard handlers snap only slider adjustments. */}
        <input className="tool-risk-slider" type="range" aria-label="Adjust risk percentage" aria-describedby="risk-help" min="0" max={sliderMax} step="any" value={riskPercent ?? 0}
          aria-valuetext={riskPercent === null ? 'Enter a valid risk percentage' : `${riskPercent}%`}
          onChange={e => setSliderRisk(Number(e.target.value))}
          onKeyDown={e => {
            const changes: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
            if (e.key in changes || e.key === 'Home' || e.key === 'End') {
              e.preventDefault();
              const direction = changes[e.key] ?? 0;
              const steps = (riskPercent ?? 0) / RISK_STEP;
              const base = direction > 0 ? Math.floor(steps) : Math.ceil(steps);
              const next = e.key === 'Home' ? RISK_STEP : e.key === 'End' ? sliderMax : (base + direction) * RISK_STEP;
              setSliderRisk(next);
            }
          }} />
        <div className="tool-range-labels" aria-hidden="true"><span>0%</span><span>{sliderMax}%</span></div>
        <p id="risk-help" className={riskPercent === null ? 'tool-error' : 'tool-hint'}>{riskPercent === null ? 'Enter a percentage greater than 0 and no more than 100.' : 'Adjust the slider in 0.25% steps, or type any decimal percentage up to 100%.'}</p>
      </Field>
      <Field id="stop-loss" title="Stop loss distance" icon={<Crosshair />}>
        <div className="tool-input-wrap"><input {...inputProps} id="stop-loss" placeholder="20" value={stop} onChange={e => setStop(e.target.value)} aria-invalid={stop !== '' && stopPips === null} aria-describedby="stop-help" /><span>pips</span></div>
        <p id="stop-help" className={stop !== '' && stopPips === null ? 'tool-error' : 'tool-hint'}>{stop !== '' && stopPips === null ? 'Enter a stop loss distance greater than zero.' : 'Distance from entry to stop loss in pips.'}</p>
      </Field>
      <Field id="trading-instrument" title="Trading instrument" icon={<TrendingUp />}>
        <select id="trading-instrument" value={symbol} onChange={e => setSymbol(e.target.value)}>{POSITION_INSTRUMENTS.map(item => <option key={item.symbol}>{item.symbol}</option>)}</select>
        <div className="tool-pip-info"><span>Pip value: {pipValue === null ? '—' : money(pipValue)}/pip/lot</span><span>Pip size: {instrument.pipSize}</span></div>
        <p className="tool-hint">1 standard lot = {number(instrument.contractSize)} {instrument.unit}.{symbol === 'XAUUSD' && ' Gold uses a $0.10 price move per pip (30 pips = $3.00 per ounce). Match your broker’s pip convention.'}</p>
        <label className="tool-check"><input type="checkbox" checked={custom} onChange={e => setCustom(e.target.checked)} />Use custom pip value</label>
        {custom && <div className="tool-custom-pip"><label htmlFor="custom-pip">Pip value in USD per standard lot</label><div className="tool-input-wrap"><span>$</span><input {...inputProps} id="custom-pip" value={customPip} onChange={e => setCustomPip(e.target.value)} aria-invalid={pipValue === null} aria-describedby="pip-help" /></div><p id="pip-help" className={pipValue === null ? 'tool-error' : 'tool-hint'}>{pipValue === null ? 'Enter a pip value greater than zero.' : 'Use the pip value from your broker’s contract specification.'}</p></div>}
      </Field>
      <div className="tool-actions"><span><Calculator size={17} />Results update automatically</span><button className="tool-back" onClick={reset}><RotateCcw size={16} />Reset</button></div>
    </div>
    <section className="tool-results" aria-label="Position size results" aria-live="polite" aria-atomic="true">
      {result && position ? <>
        <div className="tool-recommendation"><p className="tool-label">Recommended position size</p><div><strong data-testid="standard-lots" title={showGoldEstimate ? `${preciseLots(position.lots)} lots before rounding` : undefined}>{number(position.lots)}</strong><span>Standard lots</span></div>{showGoldEstimate && <p>Estimate before broker lot rounding</p>}<p>Based on {riskPercent}% risk ({money(result.riskAmount)})</p></div>
        {result.lots === 0 && <p className="tool-error" role="status">Your risk budget is too small for 0.01 standard lots. No position fits these parameters.</p>}
        <div className="tool-result-grid">
          <div><LayoutPanelLeft /><span>Mini lots</span><strong data-testid="mini-lots">{number(position.miniLots)}</strong><small>{showGoldEstimate ? 'Before broker lot rounding' : 'Equivalent position'}</small></div>
          <div><Globe /><span>Micro lots</span><strong data-testid="micro-lots">{number(position.microLots)}</strong><small>{showGoldEstimate ? 'Before broker lot rounding' : 'Equivalent position'}</small></div>
          <div><Shield /><span>Risk amount</span><strong data-testid="risk-amount">{money(result.riskAmount)}</strong><small>{riskPercent}% of balance</small></div>
          <div className="tool-loss"><AlertTriangle /><span>Loss at stop</span><strong data-testid="loss-at-stop">{money(position.lossAtStop)}</strong><small>{showGoldEstimate ? 'Using the unrounded estimate' : `For ${number(result.lots)} standard lots`}</small></div>
        </div>
        <div className="tool-trade-summary"><h3>Trade summary</h3><dl><div><dt>Account balance</dt><dd>{money(accountBalance!)}</dd></div><div><dt>Symbol</dt><dd>{symbol}</dd></div><div><dt>Stop loss</dt><dd>{stopPips} pips</dd></div><div><dt>Pip value</dt><dd>{money(pipValue!)}/pip/lot</dd></div></dl></div>
        <details className="tool-formula"><summary><HelpCircle size={17} />How is this calculated?</summary><p>Position size = risk amount ÷ (stop loss × pip value)</p><p>{money(result.riskAmount)} ÷ ({stopPips} × {money(pipValue!)}) = {result.exactLots.toLocaleString('en-US', { maximumFractionDigits: 6 })} lots before rounding.</p></details>
        <p className="tool-hint">{showGoldEstimate ? `Gold estimates use the full calculated size (${preciseLots(result.exactLots)} standard lots), with each card displayed to two decimals. At a 0.01-lot broker increment, round down to ${number(result.lots)} standard lots for ${money(result.lossAtStop)} loss at stop.` : 'Position size is rounded down to 0.01 standard lots. Loss at stop uses that rounded size.'} Estimates exclude spread, fees and slippage. Check your broker’s lot increment.</p>
      </> : <div className="tool-empty"><span className="tool-icon"><Calculator /></span><h3>{balance || stop ? 'Check Your Parameters' : 'Enter Your Parameters'}</h3><p>Enter a positive account balance, risk percentage, stop loss and pip value to calculate your position size.</p>{accountBalance && riskPercent && stopPips && pipValue && <p className="tool-error">These values are outside the supported calculation range. Enter smaller, practical values.</p>}<div><Shield />Risk amount updates as you type.</div><div><Crosshair />Set your stop loss distance in pips.</div><div><Calculator />Position size stays within your risk budget.</div></div>}
    </section>
  </div>;
}
