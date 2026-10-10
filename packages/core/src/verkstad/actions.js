// Händelser på ett ärende i Verkstad. Flyttade från klickhanteraren i legacy/apps/foliering/index.html
// (skickad, godkand, avslag, ateroppna, skapaFaktura, betald, obetald, makulera, skapaMoms, momsBetald,
// momsObetald, offertIgen, fakturaSkickad, momsSkickad, paminnelseKlar, bokfor). Varje funktion tar en
// kopia av ärendet, ändrar den och returnerar { a, msg, serie? }.
const clone = o => JSON.parse(JSON.stringify(o));

/** @param {ReturnType<import('./engine.js').createVerkstad>} V */
export function verkstadActions(V) {
  const { today, addDays, foretag, fors, kr, belopp, momsBelopp, nastaFaktura, momsEfterBetalning, log, S } = V;
  return {
    skickad(a0) { const a = clone(a0), t = today(); a.status = 'skickad'; a.offert.skickad = t; log(a, 'Offert skickad till ' + fors(a.forsakring).namn + ' (' + kr(belopp(a)) + ')'); return { a, msg: 'Offerten är markerad som skickad.' }; },
    godkand(a0, who = '') { const a = clone(a0); a.status = 'godkand'; a.offert.godkandAv = who; log(a, 'Offert godkänd' + (who ? ' av ' + who : '')); return { a }; },
    avslag(a0) { const a = clone(a0); a.status = 'avslag'; log(a, 'Offerten fick avslag'); return { a }; },
    ateroppna(a0) { const a = clone(a0); a.status = 'skickad'; log(a, 'Ärendet återöppnat'); return { a }; },
    skapaFaktura(a0) {
      const a = clone(a0), t = today(), nr = nastaFaktura(), F = foretag();
      if (a.status === 'skickad' || a.status === 'utkast') log(a, 'Offert godkänd');
      a.faktura = { nr, datum: t, forfall: addDays(t, +F.villkorDagar || 10), utfort: t, rader: clone(a.offert.rader.map(r => ({ text: r.text, antal: +r.antal, apris: +r.apris }))), betald: false, betaldDatum: '', paminnelse: '' };
      a.status = 'fakturerad'; log(a, `Faktura ${nr} skapad (${kr(belopp(a))}), förfaller ${a.faktura.forfall}`);
      return { a, msg: `Faktura ${nr} skapad. Registret är uppdaterat.`, serie: +(S.inst.serie?.nasta || 0) <= nr ? { nasta: nr + 1 } : null };
    },
    betald(a0, d) {
      const a = clone(a0); d = d || today(); a.faktura.betald = true; a.faktura.betaldDatum = d; a.status = 'betald'; log(a, `Faktura ${a.faktura.nr} betald ${d}`);
      const nm = momsEfterBetalning(a);
      return { a, msg: nm ? `Momsfaktura ${a.moms.nr} är klar att skicka till ${a.agare}.` : 'Fakturan är markerad som betald.' };
    },
    obetald(a0) { const a = clone(a0); a.faktura.betald = false; a.faktura.betaldDatum = ''; a.status = 'fakturerad'; log(a, `Betalning av faktura ${a.faktura.nr} ångrad`); return { a }; },
    makulera(a0) { const a = clone(a0); log(a, `Faktura ${a.faktura.nr} makulerad`); a.faktura = null; a.moms = null; a.status = 'godkand'; return { a, msg: 'Fakturan är makulerad.' }; },
    skapaMoms(a0) { const a = clone(a0), t = today(), F = foretag(); a.moms = { nr: 'M-' + a.faktura.nr, datum: t, forfall: addDays(t, +F.villkorDagar || 10), till: a.agare, betald: false, betaldDatum: '', skickad: '' }; log(a, `Momsfaktura ${a.moms.nr} skapad till ${a.agare} (${kr(momsBelopp(a), true)})`); return { a }; },
    momsBetald(a0, d) { const a = clone(a0); d = d || today(); a.moms.betald = true; a.moms.betaldDatum = d; log(a, `Momsfaktura ${a.moms.nr} betald ${d}`); return { a }; },
    momsObetald(a0) { const a = clone(a0); a.moms.betald = false; a.moms.betaldDatum = ''; log(a, `Betalning av ${a.moms.nr} ångrad`); return { a }; },
    offertIgen(a0) { const a = clone(a0); a.offert.paminnelse = today(); log(a, `Påminnelse om offerten skickad till ${fors(a.forsakring).namn} (${kr(belopp(a))})`); return { a, msg: 'Noterat i historiken.' }; },
    fakturaSkickad(a0) { const a = clone(a0); log(a, `Faktura ${a.faktura.nr} skickad till ${fors(a.forsakring).namn}`); return { a, msg: 'Noterat i historiken.' }; },
    momsSkickad(a0) { const a = clone(a0); a.moms.skickad = today(); delete a.moms.importerad; log(a, `Momsfaktura ${a.moms.nr} skickad till ${a.moms.till}`); return { a, msg: 'Noterat i historiken.' }; },
    paminnelseKlar(a0) { const a = clone(a0); a.faktura.paminnelse = today(); log(a, `Påminnelse skickad för faktura ${a.faktura.nr}`); return { a, msg: 'Påminnelsen är noterad.' }; },
    addlog(a0, text) { const a = clone(a0); log(a, text); return { a }; },
    /** Bokför en inbetalning från kontoutdraget mot en eller flera öppna poster (matchTx). */
    bokfor(tx, poster) {
      const out = [];
      for (const p of poster) {
        const x = clone(S.arenden.get(p.a.id));
        if (p.typ === 'f') { x.faktura.betald = true; x.faktura.betaldDatum = tx.datum; x.status = 'betald'; log(x, `Faktura ${x.faktura.nr} betald ${tx.datum} (kontoutdrag ${kr(tx.belopp)})`); momsEfterBetalning(x); }
        else { x.moms.betald = true; x.moms.betaldDatum = tx.datum; log(x, `Momsfaktura ${x.moms.nr} betald ${tx.datum}`); }
        out.push(x);
      }
      return { arenden: out, msg: poster.length > 1 ? `${poster.length} fakturor markerade som betalda.` : 'Fakturan är markerad som betald.' };
    },
    /** Nytt ärende (utkast). */
    nytt({ reg, skadenr, forsakring, storlek = 'vanlig' }) {
      const t = today(), id = 'V-' + (Math.max(1000, ...[...S.arenden.keys()].map(k => +String(k).replace(/\D/g, '') || 0)) + 1);
      const a = { id, reg: String(reg || '').toUpperCase(), skadenr: skadenr || '', forsakring, storlek, status: 'utkast', skapad: t, offert: { datum: t, giltigTom: addDays(t, +foretag().giltighet || 30), rader: [] }, logg: [] };
      log(a, 'Ärendet skapat'); return { a };
    }
  };
}
