export const ACCENT_COLORS = [
  { id: 'blue', hsl: '217 91% 60%', label: 'Blue' },
  { id: 'purple', hsl: '262 83% 65%', label: 'Purple' },
  { id: 'green', hsl: '142 71% 45%', label: 'Green' },
  { id: 'gold', hsl: '45 93% 47%', label: 'Gold' },
] as const;

const clamp = (value: number, max = 1) => Math.min(max, Math.max(0, value));
export function normalizeHex(value: string): string | null {
  const hex = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(hex)) return hex;
  if (/^#[\da-f]{3}$/.test(hex)) return '#' + [...hex.slice(1)].map(c => c + c).join('');
  return null;
}
export function normalizeAccent(value: string): string | null {
  return ACCENT_COLORS.some(c => c.id === value) ? value : normalizeHex(value);
}
function rgbToHex(rgb: number[]) {
  return '#' + rgb.map(channel => Math.round(clamp(channel) * 255).toString(16).padStart(2, '0')).join('');
}
export function hsvToHex(hue: number, saturation: number, brightness: number): string {
  const h = ((hue % 360) + 360) % 360 / 60, s = clamp(saturation / 100), v = clamp(brightness / 100);
  const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
  const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return rgbToHex(rgb.map(n => n + m));
}
export function hexToHsv(hex: string) {
  const [r, g, b] = (normalizeHex(hex) ?? '#3b82f6').slice(1).match(/../g)!.map(n => parseInt(n, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const h = !delta ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (h * 60 + 360) % 360, s: max ? delta / max * 100 : 0, v: max * 100 };
}
export function hslToHex(h: number, s: number, l: number) {
  const lightness = l / 100, saturation = s / 100;
  const v = lightness + saturation * Math.min(lightness, 1 - lightness);
  return hsvToHex(h, v ? 200 * (1 - lightness / v) : 0, v * 100);
}
export function accentHex(value: string): string {
  const preset = ACCENT_COLORS.find(c => c.id === value);
  return preset ? hslToHex(...preset.hsl.split(' ').map(parseFloat) as [number, number, number]) : normalizeHex(value) ?? accentHex('blue');
}
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const linear = hex.slice(1).match(/../g)!.map(n => {
      const c = parseInt(n, 16) / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function accentAppearance(value: string, theme: string) {
  const original = accentHex(value), { h, s: hsvS, v } = hexToHsv(original);
  const lightness = v / 100 * (1 - hsvS / 200);
  const saturation = lightness === 0 || lightness === 1 ? 0 : (v / 100 - lightness) / Math.min(lightness, 1 - lightness) * 100;
  let l = lightness * 100, hex = original;
  // Keep the chosen hue. Adapt only brightness when text/highlights need contrast.
  const light = theme === 'light', surface = light ? '#eef0f4' : '#242426';
  while (contrastRatio(hex, surface) < 5 && (light ? l > 0 : l < 100)) {
    l = clamp(l + (light ? -.5 : .5), 100);
    hex = hslToHex(h, saturation, l);
  }
  const foreground = contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000') ? '#ffffff' : '#000000';
  return { hex, hsl: `${h.toFixed(2)} ${saturation.toFixed(2)}% ${l.toFixed(2)}%`, subtleHsl: `${h.toFixed(2)} ${Math.min(saturation, 45).toFixed(2)}% ${light ? 94 : 12}%`, foreground, foregroundHsl: foreground === '#ffffff' ? '0 0% 100%' : '0 0% 0%' };
}

const HUES = [
  ['Red', 0], ['Orange', 25], ['Amber', 42], ['Yellow', 58], ['Lime', 85], ['Green', 140],
  ['Teal', 170], ['Cyan', 190], ['Blue', 215], ['Violet', 255], ['Purple', 285], ['Pink', 325],
] as const;
export const ACCENT_SWATCHES = [
  ...[88, 74, 60, 46, 32, 20].flatMap((lightness, row) => HUES.map(([name, hue]) => ({ label: `${name} shade ${row + 1}`, hex: hslToHex(hue, 78, lightness) }))),
  ...[98, 86, 74, 62, 50, 38, 26, 12].map((l, i) => ({ label: `Gray shade ${i + 1}`, hex: hslToHex(0, 0, l) })),
  ...[75, 55, 38, 24].map((l, i) => ({ label: `Brown shade ${i + 1}`, hex: hslToHex(25, 38, l) })),
];
