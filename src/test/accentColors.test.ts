import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS, ACCENT_SWATCHES, accentAppearance, accentHex, contrastRatio, hexToHsv, hsvToHex, normalizeAccent, normalizeHex } from '@/lib/accentColors';
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
  it('keeps text and button labels readable for every swatch and extreme custom shades in both themes', () => {
    const colors = [...ACCENT_COLORS.map(c => c.id), ...ACCENT_SWATCHES.map(c => c.hex), '#000000', '#ffffff', '#ffff00', '#00ffff', '#000001', '#fffffe'];
    for (const theme of ['light', 'dark']) for (const color of colors) {
      const appearance = accentAppearance(color, theme);
      const surfaces = theme === 'light' ? ['#ffffff', '#f5f7fa', '#eef0f4'] : ['#000000', '#0a0a0a', '#141414', '#242426'];
      for (const surface of surfaces) expect(contrastRatio(appearance.hex, surface), color + ' on ' + surface).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(appearance.hex, appearance.foreground), color + ' button').toBeGreaterThanOrEqual(4.5);
      expect(normalizeAccent(color)).toBe(color);
    }
    expect(accentHex('#000000')).toBe('#000000');
  });
});
