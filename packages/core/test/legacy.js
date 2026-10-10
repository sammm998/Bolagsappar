// Laddar motorerna direkt ur legacy/apps/*/index.html i en sandlåda, så att testerna kan jämföra
// packages/core mot originalkoden med samma indata. legacy/ ändras aldrig.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const html = app => fs.readFileSync(path.join(ROOT, 'legacy/apps', app, 'index.html'), 'utf8');

function between(src, start, end) {
  const a = src.indexOf(start); if (a < 0) throw new Error('hittar inte ' + start);
  const b = src.indexOf(end, a); if (b < 0) throw new Error('hittar inte ' + end);
  return src.slice(a, b);
}

function run(code, extra = {}) {
  const module = { exports: {} };
  const ctx = vm.createContext({ module, console, Intl, Date, Math, JSON, Number, String, Object, Array, Set, Map, WeakMap, RegExp, TextDecoder, TextEncoder, parseInt, parseFloat, isNaN, ...extra });
  vm.runInContext(code, ctx, { filename: 'legacy.js' });
  return { exports: module.exports, ctx };
}

/** Avräkningens kärnlogik (raderna mellan "Kärnlogik" och "Sidans logik"). */
export function legacyAvrakning() {
  const code = between(html('avrakning'), '// ===== Kärnlogik', '// ===== Sidans logik');
  return run(code).exports;
}

/** ENG ur akarkassan eller tripkassan. */
export function legacyENG(app = 'akarkassan') {
  const src = html(app);
  const code = between(src, 'const ENG = (() => {', "if (typeof module !== 'undefined') module.exports = ENG;") + "\nmodule.exports = ENG;";
  return run(code).exports;
}

/** lonOf och dess hjälpfunktioner med ett givet S (settings, skatt, period). */
export function legacyLon(app, S) {
  const src = html(app);
  const eng = between(src, 'const ENG = (() => {', "if (typeof module !== 'undefined') module.exports = ENG;");
  const fn = name => {
    const m = src.match(new RegExp('^(function ' + name + '\\(|const ' + name + ' =)', 'm'));
    if (!m) throw new Error('hittar inte ' + name);
    if (m[0].startsWith('function')) { let d = 0, i = src.indexOf('{', m.index); for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; } return src.slice(m.index, i + 1); }
    return src.slice(m.index, src.indexOf('\n', m.index));
  };
  const code = [eng, 'const S = __S;', 'function cfg() { return { ...ENG.DEF, ...S.settings.cfg }; }', 'function sum(a, f) { return a.reduce((s, x) => s + (f(x) || 0), 0); }',
    fn('utbMan'), fn('utbDatum'), fn('person'), fn('tabellFor'), fn('parseKr'), fn('ytd'), fn('lonOf'),
    'module.exports = { ENG, lonOf, utbMan, utbDatum, ytd };'].join('\n');
  return run(code, { __S: S }).exports;
}

/** Folieringens funktioner (samma radintervall som packages/core/src/verkstad/engine.js) med givet S och datum. */
export function legacyFoliering(S, todayStr) {
  const L = html('foliering').split('\n');
  const r = (a, b) => L.slice(a - 1, b).join('\n');
  let body = [r(273, 293), r(294, 317), r(325, 356), r(367, 367), r(640, 674), r(711, 724), r(747, 773), r(793, 812), r(913, 960), r(1132, 1242), r(1345, 1351), r(1440, 1453), r(1743, 1744)].join('\n');
  body = body.replace(/const today = \(\) => \{[^\n]*\};/, `const today = () => ${JSON.stringify(todayStr)};`);
  body = body.replace("const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];", '');
  const code = 'const S = __S;\n' + body + '\nmodule.exports = { genAuto, utkast, bygSie, kalkylA, manadsData, matchTx, momsEfterBetalning, nastaFaktura, periodSum, varningar, lsCalc, parseBgSpec, txFromLines, meterpris };';
  return run(code, { __S: S }).exports;
}
