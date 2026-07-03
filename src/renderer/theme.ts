export const channels = (color: string) => {
  const value = color.replace('#', '');

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ] as const;
};

export const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

export const mixToward = (color: string, target: number, amount: number) => {
  const [r, g, b] = channels(color);

  return toHex(
    r + (target - r) * amount,
    g + (target - g) * amount,
    b + (target - b) * amount,
  );
};

export const lighten = (color: string, amount: number) =>
  mixToward(color, 255, amount);

export const darken = (color: string, amount: number) =>
  mixToward(color, 0, amount);

export const alpha = (color: string, value: number) => {
  const [r, g, b] = channels(color);

  return `rgba(${r}, ${g}, ${b}, ${value})`;
};

const accent = '#d54b30';
const accentBright = '#ff5a3c';
const accentHover = lighten(accent, 0.14);
const accentDeep = darken(accent, 0.16);
const accentText = lighten(accent, 0.15);

export const themedark = {
  color: {
    bg: '#141517',
    surface: '#1c1d20',
    surfaceRaised: '#232428',
    surfaceSunken: '#0e0f11',
    headerGradient: 'linear-gradient(180deg, #232428, #191a1d)',

    border: 'rgba(255,255,255,0.07)',
    borderSoft: 'rgba(255,255,255,0.04)',
    divider: 'rgba(255,255,255,0.05)',
    fill: 'rgba(255,255,255,0.04)',
    fillStrong: 'rgba(255,255,255,0.10)',

    text: '#f2ede1',
    textBody: '#e6e0d3',
    textMuted: '#9c9484',
    textFaint: '#8a8474',
    textDim: '#615c50',
    textDimmer: '#5f5a4e',

    star: 'rgb(232, 183, 58)',
    starPerfect: '#d8dde6',

    accent,
    accentBright,
    accentHover,
    accentDeep,
    accentText,
    accentInk: '#1a160f',
    accentGradient: `linear-gradient(145deg, ${accentHover}, ${accentDeep})`,
    accentGradientFade: `linear-gradient(90deg, ${alpha(
      accent,
      0.35,
    )}, rgba(255, 255, 255, 0.04))`,
    accentSoftBg: alpha(accent, 0.08),
    accentSoftBorder: alpha(accent, 0.22),

    paper: '#ece3d0',
    ink: '#1c1a14',
    inkSoft: '#4a463c',

    green: '#1f8a4c',
    orange: '#d15a12',
    blue: '#1b6fc0',
    yellow: '#C8930F',
    red: '#c62828',
  },

  font: {
    display: "'Newsreader', Georgia, serif",
    ui: "'Space Grotesk', system-ui, sans-serif", // labels, body, numbers
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  },

  fontSize: {
    sheetTitle: 32,
    sectionTitle: 24,
    songTitle: 19,
    panelTitle: 21,
    transportTitle: 17,
    body: 15,
    label: 14,
    small: 13.5,
    caption: 12.5,
    overline: 12,
    micro: 11,
  },

  radius: {
    xs: 2,
    sm: 8,
    md: 11,
    lg: 14,
    xl: 18,
    panel: 22,
    pill: 999,
  },

  shadow: {
    frame:
      '0 40px 90px -30px rgba(40,30,10,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
    star: 'drop-shadow(rgba(232, 183, 58, 0.45) 0px 3px 8px)',
    starPerfect: 'drop-shadow(0 3px 10px rgba(196,210,230,0.55))',
    panel:
      '0 40px 90px -30px rgba(40,30,10,0.55), 0 0 0 1px rgba(255,255,255,0.05)',
    accentButton: `0 12px 32px -6px ${alpha(
      accent,
      0.6,
    )}, inset 0 1px 0 rgba(255,255,255,0.3)`,
    accentChip: `0 6px 16px -4px ${alpha(accent, 0.5)}`,
    accentSoft: `0 6px 6px -6px ${alpha(accent, 0.5)}`,
    paper:
      'inset 0 1px 0 rgba(255,255,255,0.6), 0 18px 40px -20px rgba(0,0,0,0.6)',
    floatLabel: '0 8px 20px rgba(0,0,0,0.4)',
  },

  space: { xs: 4, sm: 8, md: 14, lg: 22, xl: 26, xxl: 40 },

  control: {
    toggleOn: accent,
    toggleOffTrack: 'rgba(255,255,255,0.10)',
    toggleKnobOn: '#ffffff',
    toggleKnobOff: '#7a7466',
    sliderTrack: 'rgba(255,255,255,0.08)',
    sliderFill: `linear-gradient(90deg, ${accentDeep}, ${accent})`,
    sliderFillMuted: 'rgba(255,255,255,0.18)',
    sliderThumb: '#ffffff',
    iconButtonBg: 'rgba(255,255,255,0.05)',
    iconButtonActiveBg: alpha(accent, 0.14),
    iconButtonActiveBorder: alpha(accent, 0.28),
  },
};

export default themedark;
