import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS, ACCENT_SWATCHES, accentAppearance, accentHex, contrastRatio, hexToHsv, hslToHex, hsvToHex, normalizeAccent, normalizeHex } from '@/lib/accentColors';
import { resolvePreferences } from '@/lib/workspacePreferences';

describe('custom workspace accents', () => {
  it('preserves four named presets and accepts only safe hex colors', () => {
    for (const color of ACCENT_COLORS) expect(normalizeAccent(color.id)).toBe(color.id);
    expect(normalizeHex(' #ABC ')).toBe('#aabbcc');
    expect(normalizeAccent('#12ABCD')).toBe('#12abcd');
    expect(resolvePreferences({ accent_color: '#12ABCD' }).accent_color).toBe('#12abcd');
    for (const invalid of ['', '#1234', 'red', 'url(https://example.com)', 'blue; color: red', '#gggggg']) {
      expect(normalizeAccent(invalid)).toBeNull();
      expect(resolvePreferences({ accent_color: invalid }).accent_color).toBe('blue');
    }
  });
  it('round-trips RGB colors through gradient coordinates without losing color', () => {
    for (const hex of ['#000000', '#ffffff', '#123456', '#ff0000', '#00ff00', '#0000ff', '#808080', ...ACCENT_SWATCHES.map(c => c.hex)]) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
    expect(ACCENT_SWATCHES).toHaveLength(84);
    expect(new Set(ACCENT_SWATCHES.map(c => c.hex)).size).toBe(84);
  });
  it('uses the exact chosen color in both themes, with contrasting labels instead of color substitution', () => {
    const colors = [...ACCENT_COLORS.map(c => c.id), ...ACCENT_SWATCHES.map(c => c.hex), '#000000', '#ffffff', '#ffff00', '#00ffff', '#000001', '#fffffe', '#ff0001', '#12abcd'];
    for (const theme of ['light', 'dark']) for (const color of colors) {
      const appearance = accentAppearance(color, theme);
      expect(appearance.hex).toBe(accentHex(color));
      expect(hslToHex(...appearance.hsl.split(' ').map(parseFloat) as [number, number, number])).toBe(accentHex(color));
      expect(contrastRatio(appearance.hex, appearance.foreground), color + ' button').toBeGreaterThanOrEqual(4.5);
      expect(normalizeAccent(color)).toBe(color);
    }
    expect(accentAppearance('#000000', 'dark').needsContrastSupport).toBe(true);
    expect(accentAppearance('#ffffff', 'light').needsContrastSupport).toBe(true);
  });
  it('does not lose RGB precision through the shared HSL tokens', () => {
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
      const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
      const { hsl } = accentAppearance(hex, 'light');
      expect(hslToHex(...hsl.split(' ').map(parseFloat) as [number, number, number])).toBe(hex);
    }
  });
});
