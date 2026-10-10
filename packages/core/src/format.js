// Formatering enligt reglerna: belopp i sv-SE, datum ÅÅÅÅ-MM-DD. Mellanslag i stället för hårt mellanslag
// så att siffror kan kopieras.
const nf2 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const sp = s => s.replace(/[  ]/g, ' ').replace(/−/g, '-');
export const kr2 = x => x == null || x === '' || isNaN(+x) ? '' : sp(nf2.format(+x));
export const kr0 = x => x == null || x === '' || isNaN(+x) ? '' : sp(nf0.format(+x));
export const krs = (x, dec = true) => (dec ? kr2(x) : kr0(x)) + ' kr';
export const tal = x => kr0(x);
export const pct = (x, dec = 1) => sp(new Intl.NumberFormat('sv-SE', { maximumFractionDigits: dec }).format(x)) + ' %';
export const datum = d => { if (!d) return ''; if (typeof d === 'string') return d.slice(0, 10); const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
export const tid = d => { const x = typeof d === 'string' ? new Date(d) : d; return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const DAG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
export const manad = p => p ? MAN[+p.slice(5, 7) - 1] : '';
export const Manad = p => { const m = manad(p); return m.charAt(0).toUpperCase() + m.slice(1); };
export const manadAr = p => p ? Manad(p) + ' ' + p.slice(0, 4) : '';
export const kortManad = p => p ? Manad(p).slice(0, 3) : '';
export const dagText = d => { const x = new Date(d + 'T12:00:00'); return x.getDate() + ' ' + MAN[x.getMonth()]; };
export const veckodagDatum = (d = new Date()) => { const s = DAG[d.getDay()]; return s.charAt(0).toUpperCase() + s.slice(1) + ' ' + d.getDate() + ' ' + MAN[d.getMonth()]; };
export const ymAdd = (p, n) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
export const initialer = s => String(s || '').replace(/\b(AB|HB|KB)\b/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const relativDag = (iso, nu = new Date()) => {
  if (!iso) return '';
  const d = Math.floor((new Date(nu.toISOString().slice(0, 10)) - new Date(String(iso).slice(0, 10))) / 864e5);
  return d <= 0 ? 'i dag' : d === 1 ? 'i går' : d + ' dagar';
};
export const fornamn = n => String(n || '').trim().split(/\s+/)[0] || '';
