// Samma tokens som packages/ui/tokens.css (plattformens vita yta).
import { Platform } from 'react-native';
export const C = {
  navy: '#0E1E35', navy2: '#1B2C47', green: '#1F4D3A', greenSoft: '#E7F0EA', greenMid: '#A9C9B6',
  white: '#FFFFFF', line: '#E7E9ED', subtle: '#F7F8F9', muted: '#6B7385', text: '#0E1E35', text2: '#3B465A',
  okBg: '#E7F0EA', ok: '#1F4D3A', warnBg: '#FBF0D9', warn: '#8A5A00', badBg: '#FBE6E2', bad: '#A33A22', infoBg: '#E8EEF8', info: '#2A4A7F'
};
export const F = { mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, monospace' }) };
