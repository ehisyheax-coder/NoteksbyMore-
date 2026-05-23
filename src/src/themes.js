export const THEMES = {
  original: { h: 0, accent: '#ffddaa', glow: 'rgba(255,220,170,0.3)', rainColor: [150,130,100], useOriginal: true },
  green: { h: 140, accent: '#00ff66', glow: 'rgba(0,255,102,0.35)', rainColor: [0,200,100], useOriginal: false },
  cyan: { h: 185, accent: '#00e5ff', glow: 'rgba(0,229,255,0.35)', rainColor: [0,180,200], useOriginal: false },
  amber: { h: 38, accent: '#ffaa00', glow: 'rgba(255,170,0,0.35)', rainColor: [200,150,0], useOriginal: false },
  neon: { h: 310, accent: '#ff44ff', glow: 'rgba(255,68,255,0.35)', rainColor: [200,0,200], useOriginal: false },
  cyberpunk: { h: 280, accent: '#00ffff', glow: 'rgba(0,255,255,0.4)', rainColor: [0,255,200], useOriginal: false }
};

export function hslToRgb(h, s, l) {
  if (s === 0) return { r: Math.round(l * 255), g: Math.round(l * 255), b: Math.round(l * 255) };
  const h2r = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(h2r(p, q, h + 1/3) * 255),
    g: Math.round(h2r(p, q, h) * 255),
    b: Math.round(h2r(p, q, h - 1/3) * 255)
  };
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function getEulerColor(cell, eulerMixValue, contrastValue, themeName) {
  if (!cell.isForeground) return { r: 0, g: 0, b: 0 };
  const mix = eulerMixValue / 100;
  const contrast = contrastValue / 100;
  const theme = THEMES[themeName] || THEMES.cyberpunk;
  const origHsl = rgbToHsl(cell.bledR, cell.bledG, cell.bledB);
  const rawEuler = (cell.phase / (2 * Math.PI) + cell.freq * 0.5);
  const eulerHue = (((rawEuler % 1) + 1) % 1) * 360;
  let hue = origHsl.h * 0.7 + eulerHue * 0.3;
  let saturation = Math.min(100, origHsl.s * 1.3 + 15 * cell.brightness);
  let lightness = 38 + 42 * Math.pow(cell.brightness, 0.75) * contrast;
  lightness = Math.min(80, Math.max(10, lightness));

  if (theme.useOriginal) {
    saturation = Math.min(100, origHsl.s * 1.4 + 10);
    if (mix < 1) hue = hue * (1 - (1 - mix) * 0.3) + eulerHue * (1 - mix) * 0.3;
  } else if (themeName === 'cyberpunk') {
    hue = cell.brightness < 0.5 ? 300 - cell.brightness * 80 : 180 + (1 - cell.brightness) * 40;
    saturation = 85 + 15 * cell.brightness;
    hue = hue * mix + origHsl.h * (1 - mix);
  } else {
    hue = hue * mix + theme.h * (1 - mix);
    saturation = saturation * mix + 70 * (1 - mix);
  }
  hue = ((hue % 360) + 360) % 360;
  return hslToRgb(hue / 360, Math.min(100, saturation) / 100, lightness / 100);
}
