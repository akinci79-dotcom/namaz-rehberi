export type ThemeName = 'dark' | 'light';

export interface Theme {
  name: ThemeName;
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  arabic: string;
  danger: string;
  dangerSoft: string;
  progressTrack: string;
  progressFill: string;
  badgeBg: string;
  badgeText: string;
  overlay: string;
}

export const darkTheme: Theme = {
  name: 'dark',
  bg: '#0C100E',
  surface: '#161C19',
  surfaceRaised: '#1E2723',
  border: '#2C3832',
  text: '#F4EFE4',
  textMuted: '#A39B8C',
  accent: '#D4A84B',
  accentSoft: '#2A2416',
  accentText: '#1A1408',
  arabic: '#E8D39A',
  danger: '#E8B4B4',
  dangerSoft: '#2A1818',
  progressTrack: '#2A3330',
  progressFill: '#D4A84B',
  badgeBg: '#2A2416',
  badgeText: '#E8D39A',
  overlay: 'rgba(0,0,0,0.35)',
};

export const lightTheme: Theme = {
  name: 'light',
  bg: '#F4EFE6',
  surface: '#FFFBF3',
  surfaceRaised: '#FFFFFF',
  border: '#E2D6C0',
  text: '#1A1814',
  textMuted: '#6B6356',
  accent: '#8A6A1F',
  accentSoft: '#F3E6C4',
  accentText: '#FFF8E8',
  arabic: '#5C4A16',
  danger: '#8B3A3A',
  dangerSoft: '#F6E4E4',
  progressTrack: '#E6DCC8',
  progressFill: '#8A6A1F',
  badgeBg: '#F3E6C4',
  badgeText: '#5C4A16',
  overlay: 'rgba(255,255,255,0.4)',
};

export function themeFromScheme(scheme: string | null | undefined): Theme {
  return scheme === 'light' ? lightTheme : darkTheme;
}
