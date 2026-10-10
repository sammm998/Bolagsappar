// Vem får godkänna och publicera en månad (öppen fråga 07). Spec sidan 5: rollen Ekonomi får ladda upp, räkna,
// godkänna och publicera. Varje konto kan begränsa det under Inställningar (settings.godkannande.roller).
// Samma regel finns i databasen (app.kan_godkanna) och i den lokala backenden.

export const ROLLER = ['agare', 'admin', 'ekonomi', 'forare', 'las'];
export const GODKANNANDE_DEF = ['agare', 'admin', 'ekonomi'];
/** Roller som aldrig får godkänna, oavsett inställning. */
const ALDRIG = ['forare', 'las'];

export function godkannRoller(tenant) {
  const r = tenant?.settings?.godkannande?.roller;
  const L = Array.isArray(r) && r.length ? r.filter(x => ROLLER.includes(x) && !ALDRIG.includes(x)) : GODKANNANDE_DEF;
  return L.includes('agare') ? L : ['agare', ...L];
}
export const kanGodkanna = (tenant, role) => godkannRoller(tenant).includes(role);
