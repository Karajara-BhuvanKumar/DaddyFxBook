import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check } from 'lucide-react';
import { ACCENT_COLORS, ACCENT_SWATCHES, accentAppearance, accentHex, contrastRatio, hexToHsv, hsvToHex, normalizeHex } from '@/lib/accentColors';

type Props = { value: string; onChange: (value: string) => void; onValidityChange: (valid: boolean) => void; disabled?: boolean };

export default function AccentColorPicker({ value, onChange, onValidityChange, disabled = false }: Props) {
  const hex = accentHex(value);
  const [hexText, setHexText] = useState(hex);
  const [hsv, setHsv] = useState(() => hexToHsv(hex));
  const emittedValue = useRef(value);
  const valid = normalizeHex(hexText) !== null;
  useEffect(() => {
    if (value !== emittedValue.current) {
      setHexText(accentHex(value));
      setHsv(hexToHsv(accentHex(value)));
      emittedValue.current = value;
    }
  }, [value]);

  function choose(next: string, coordinates = hexToHsv(accentHex(next))) {
    emittedValue.current = next;
    setHsv(coordinates); setHexText(accentHex(next));
    onValidityChange(true); onChange(next);
  }
  function changeHsv(patch: Partial<typeof hsv>) {
    const next = { ...hsv, ...patch };
    choose(hsvToHex(next.h, next.s, next.v), next);
  }
  function pickPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    changeHsv({ s: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), v: Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100)) });
  }

  return <section className="accent-picker" aria-labelledby="accent-title">
    <div className="accent-heading"><div><h3 id="accent-title">Accent color</h3><p className="settings-hint">Pick a shade or create your own. Applied to your workspace only after saving.</p></div><span className="accent-selected"><i style={{ background: hex }} />{hex.toUpperCase()}</span></div>
    <div className="accent-editor">
      <div className="accent-custom">
        <div className="accent-gradient" aria-label="Color gradient; use the sliders below for keyboard selection" role="group" aria-disabled={disabled}
          style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
          onPointerDown={event => { if (disabled || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); pickPoint(event); }}
          onPointerMove={event => { if (!disabled && event.currentTarget.hasPointerCapture(event.pointerId)) pickPoint(event); }}>
          <span style={{ left: `clamp(8px, ${hsv.s}%, calc(100% - 8px))`, top: `clamp(8px, ${100 - hsv.v}%, calc(100% - 8px))`, background: hex }} />
        </div>
        <label className="accent-slider-label" htmlFor="accent-hue">Hue <span>{Math.round(hsv.h)}°</span></label>
        <input id="accent-hue" className="accent-slider accent-hue" type="range" step="any" min="0" max="359" value={hsv.h} disabled={disabled} onChange={e => changeHsv({ h: Number(e.target.value) })} />
        <div className="accent-tuning">
          <div><label className="accent-slider-label" htmlFor="accent-saturation">Saturation <span>{Math.round(hsv.s)}%</span></label><input id="accent-saturation" className="accent-slider" type="range" step="any" min="0" max="100" value={hsv.s} disabled={disabled} onChange={e => changeHsv({ s: Number(e.target.value) })} /></div>
          <div><label className="accent-slider-label" htmlFor="accent-brightness">Brightness <span>{Math.round(hsv.v)}%</span></label><input id="accent-brightness" className="accent-slider" type="range" step="any" min="0" max="100" value={hsv.v} disabled={disabled} onChange={e => changeHsv({ v: Number(e.target.value) })} /></div>
        </div>
        <label className="accent-slider-label" htmlFor="accent-hex">Custom color</label>
        <div className="accent-hex-row">
          <input type="color" aria-label="Open custom color picker" value={hex} disabled={disabled} onChange={e => choose(e.target.value)} />
          <input id="accent-hex" type="text" value={hexText} spellCheck={false} autoComplete="off" maxLength={7} aria-invalid={!valid} aria-describedby="accent-hex-hint" disabled={disabled}
            onChange={e => {
              const text = e.target.value; setHexText(text);
              const next = normalizeHex(text); onValidityChange(!!next);
              if (next) { emittedValue.current = next; setHsv(hexToHsv(next)); onChange(next); }
            }} />
        </div>
        <p id="accent-hex-hint" className={valid ? 'settings-hint' : 'accent-error'}>{valid ? 'Use a hex color, for example #3B82F6.' : 'Enter a valid hex color, such as #3B82F6.'}</p>
      </div>
      <div className="accent-palette">
        <p className="accent-section-label">Original presets</p>
        <div className="accent-presets">{ACCENT_COLORS.map(color => <button type="button" key={color.id} aria-label={`${color.label} accent`} aria-pressed={value === color.id} disabled={disabled} onClick={() => choose(color.id)}><i style={{ background: accentHex(color.id) }} />{color.label}{value === color.id && <Check size={13} />}</button>)}</div>
        <p className="accent-section-label">Spectrum & shades <span>84 colors</span></p>
        <div className="accent-swatches" role="group" aria-label="Color swatches">{ACCENT_SWATCHES.map(color => <button type="button" key={color.label} aria-label={`${color.label} ${color.hex}`} title={`${color.label} · ${color.hex.toUpperCase()}`} aria-pressed={hex === color.hex} disabled={disabled} onClick={() => choose(color.hex)} style={{ background: color.hex, color: contrastRatio(color.hex, '#ffffff') > contrastRatio(color.hex, '#000000') ? '#fff' : '#000' }}>{hex === color.hex && <Check size={15} />}</button>)}</div>
        <p className="settings-hint accent-palette-note">From soft pastels to deep tones, with neutral and brown shades.</p>
      </div>
    </div>
    <div className="accent-preview-heading"><span>Color preview</span><span>Only these samples change while you edit.</span></div>
    <div className="accent-previews">{['light', 'dark'].map(theme => {
      const appearance = accentAppearance(value, theme);
      return <div key={theme} className={`accent-preview accent-preview-${theme}`} aria-label={`${theme === 'light' ? 'Light' : 'Dark'} mode accent preview`} style={{ '--sample-accent': appearance.hex, '--sample-ink': appearance.foreground } as CSSProperties}>
        <span className="accent-preview-title">{theme === 'light' ? 'Light' : 'Dark'} mode</span>
        <div><span className="accent-preview-button">Button</span><span className="accent-preview-link">Active item</span><svg viewBox="0 0 90 32" aria-hidden="true"><path d="M2 28 L20 19 L35 24 L52 10 L68 15 L88 3" /></svg></div>
      </div>;
    })}</div>
    <p className="settings-hint">Accent brightness and button text adapt for contrast in each theme. Your chosen color is preserved.</p>
  </section>;
}
