// Siffror till adminportalen (sidan 43). Skärmarna räknar inte själva.

const TYP = { main: 'Huvudkund', sub: 'Underkund', direct: 'Direktkund', platform: 'Plattform' };

/** Kunder på toppnivå med antal underkunder, moduler och status. */
export function kundlista(tenants, licenses, modules = []) {
  const namn = k => modules.find(m => m.key === k)?.name || k;
  const top = tenants.filter(t => t.type === 'main' || t.type === 'direct');
  return top.map(t => {
    const L = licenses.filter(l => l.tenant_id === t.id);
    const subs = tenants.filter(s => s.parent_id === t.id);
    const s = t.settings || {};
    const status = s.status === 'bygger' ? `Bygger, dag ${s.dag || '?'} av ${s.dagar || 14}` : s.status === 'arbetsdag' ? `Arbetsdag ${s.arbetsdag}` : L.some(l => l.status === 'aktiv') ? 'Aktiv' : 'Ny';
    return { id: t.id, slug: t.slug, namn: t.name, typ: TYP[t.type], underkunder: subs.length, ord: t.brand?.akarOrd === 'underleverantör' ? 'underleverantörer' : 'åkare', moduler: [...new Set(L.map(l => namn(l.module_key)))], status, ton: status === 'Aktiv' ? 'ok' : status === 'Ny' ? 'draft' : 'info' };
  });
}

export function konton(tenants) {
  const c = k => tenants.filter(t => t.type === k).length;
  return { totalt: tenants.filter(t => t.type !== 'platform').length, main: c('main'), sub: c('sub'), direct: c('direct') };
}

export function leveranser(tenants) {
  return tenants.filter(t => ['bygger', 'arbetsdag'].includes(t.settings?.status)).map(t => ({ id: t.id, namn: t.name, typ: TYP[t.type], status: t.settings.status, dag: t.settings.dag || null, dagar: t.settings.dagar || 14, datum: t.settings.arbetsdag || null }));
}

/** Licenser per modul: antal konton och varianter. */
export function modulStatistik(modules, licenses) {
  return modules.map(m => {
    const L = licenses.filter(l => l.module_key === m.key && l.status === 'aktiv');
    return { key: m.key, namn: m.name, version: m.version, status: m.status, konton: new Set(L.map(l => l.tenant_id)).size, varianter: [...new Set(L.map(l => l.variant))], alla: Object.keys(m.variants || {}) };
  });
}

/**
 * Var fastnar användarna? För varje guidesteg: bland konton som har påbörjat modulens guide,
 * hur stor andel som inte klarat steget. checklists: { [modul]: { [variant]: [{key,title}] } }.
 */
export function fastnar(licenses, progress, checklists) {
  const out = [];
  for (const [mk, vs] of Object.entries(checklists)) {
    for (const [variant, steps] of Object.entries(vs)) {
      if (!steps?.length) continue;
      const konton = licenses.filter(l => l.module_key === mk && l.variant === variant && l.status === 'aktiv').map(l => l.tenant_id);
      const P = progress.filter(p => p.module_key === mk && konton.includes(p.tenant_id));
      const startat = new Set(P.map(p => p.tenant_id));
      if (!startat.size) continue;
      for (const s of steps) {
        const klar = new Set(P.filter(p => p.step_key === s.key).map(p => p.tenant_id)).size;
        out.push({ modul: mk, variant, steg: s.key, titel: s.title, startat: startat.size, klar, fastnar: 1 - klar / startat.size });
      }
    }
  }
  return out.sort((a, b) => b.fastnar - a.fastnar || b.startat - a.startat);
}

/** Andel konton som har klarat alla steg i guiden för minst en modul. */
export function guiderAvslutade(licenses, progress, checklists) {
  let n = 0, klara = 0;
  for (const l of licenses.filter(x => x.status === 'aktiv')) {
    const steps = checklists[l.module_key]?.[l.variant];
    if (!steps?.length) continue;
    const P = progress.filter(p => p.module_key === l.module_key && p.tenant_id === l.tenant_id);
    if (!P.length) continue;
    n++; if (steps.every(s => P.some(p => p.step_key === s.key))) klara++;
  }
  return n ? klara / n : null;
}

/**
 * Fakturarader per betalare. prisFor(modul, variant) ger { manad, perUnderkund } eller 'ingar'.
 * En licens med eget pris (license.price) går före prislistan. Underkunder som ingår betalas av huvudkunden per åkare.
 */
export function fakturering(licenses, tenants, prisFor) {
  const aktiva = licenses.filter(l => l.status === 'aktiv');
  const namn = id => tenants.find(t => t.id === id)?.name || id;
  const per = new Map();
  const add = (betalare, rad) => { if (!per.has(betalare)) per.set(betalare, { betalare, namn: namn(betalare), rader: [], summa: 0 }); const x = per.get(betalare); x.rader.push(rad); x.summa += rad.belopp; };
  for (const l of aktiva) {
    const p = l.price != null ? { manad: +l.price } : prisFor(l.module_key, l.variant);
    if (!p || p === 'ingar') continue;
    const betalare = l.paid_by || l.tenant_id;
    add(betalare, { modul: l.module_key, variant: l.variant, text: 'Månadsavgift', antal: 1, apris: p.manad, belopp: p.manad, konto: l.tenant_id });
    if (p.perUnderkund) {
      const subs = new Set(tenants.filter(t => t.parent_id === l.tenant_id).map(t => t.id));
      const n = aktiva.filter(x => subs.has(x.tenant_id) && x.module_key === l.module_key && (x.paid_by === l.tenant_id)).length;
      if (n) add(betalare, { modul: l.module_key, variant: l.variant, text: 'Per ansluten åkare', antal: n, apris: p.perUnderkund, belopp: n * p.perUnderkund, konto: l.tenant_id });
    }
  }
  return [...per.values()].sort((a, b) => b.summa - a.summa);
}

/** Månadsintäkt (MRR) från alla aktiva licenser. */
export const manadsintakt = (licenses, tenants, prisFor) => fakturering(licenses, tenants, prisFor).reduce((s, x) => s + x.summa, 0);
