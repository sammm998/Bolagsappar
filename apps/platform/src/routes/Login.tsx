// Inloggning och kontoval (sidan 26). E-postlänk i stället för BankID. Har man flera bolag väljer man efter inloggning.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Avatar, Button, Icon, Logo, TextField, useToast } from '@bolagsappar/ui';
import { initialer } from '@bolagsappar/core/format';
import { useBackend } from '../lib/backend';
import { useSession, typText, ROLLNAMN } from '../lib/session';

export function homeFor(a: any) { return a.tenant.type === 'platform' ? '/admin' : '/' + a.tenant.slug; }

export function Login({ pick = false }: { pick?: boolean }) {
  const b = useBackend(); const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (s.loading || !s.user) return;
    if (s.accounts.length === 1 && !pick) nav({ to: homeFor(s.accounts[0]) });
    else if (!pick) nav({ to: '/valj-bolag' });
  }, [s.loading, s.user, s.accounts, pick, nav]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Skriv din e-postadress, till exempel namn@foretag.se.', { tone: 'bad' }); return; }
    setBusy(true);
    try { const r = await b.signInWithEmail(email); if (!r.demo) setSent(true); }
    catch (err: any) { toast(err.message || 'Kunde inte skicka länken. Försök igen.', { tone: 'bad' }); }
    setBusy(false);
  };
  const demo = b.demoLogins?.() || [];
  return (
    <div className="pf-login">
      <section className="pf-login__left">
        <Logo size={22} />
        <div className="pf-login__form">
          {sent ? (
            <>
              <h1 className="pf-h1" style={{ fontSize: 28 }}>Kolla din e-post</h1>
              <p className="pf-lead">Vi har skickat en inloggningslänk till <b>{email}</b>. Öppna den på den här enheten. Länken gäller i en timme.</p>
              <Button onClick={() => setSent(false)}>Använd en annan adress</Button>
            </>
          ) : (
            <>
              <div><h1 className="pf-h1" style={{ fontSize: 28 }}>Logga in</h1><p className="pf-lead">Till alla appar för ditt bolag, på ett ställe.</p></div>
              <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
                <TextField label="E-post" type="email" autoComplete="email" placeholder="namn@foretag.se" value={email} onChange={e => setEmail(e.target.value)} required />
                <Button type="submit" variant="primary" size="lg" icon="mail" loading={busy}>Skicka inloggningslänk</Button>
              </form>
              {demo.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="pf-or">demoläge, inga riktiga uppgifter</div>
                  <ul className="pf-list-plain" style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                    {demo.map((d: any) => (
                      <li key={d.id}><button className="pf-acct" onClick={() => b.signInAsDemo(d.id)}><Avatar text={initialer(d.name)} round size="sm" /><span className="ba-grow"><b>{d.name}</b><small>{d.roll}</small></span><Icon name="right" size={14} /></button></li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <p className="small muted">Fått en inbjudan från din central? Öppna länken i inbjudan så kopplas du ihop automatiskt.</p>
      </section>
      <section className="pf-login__right">
        {s.user && s.accounts.length ? <Picker /> : (
          <div style={{ maxWidth: 380 }}>
            <h2 className="serif" style={{ fontSize: 44, lineHeight: 1.05 }}>Mindre Excel. <i style={{ color: 'var(--green-mid)' }}>Mer körning.</i></h2>
            <p style={{ opacity: .8, marginTop: 14 }}>Avräkning, förarlista, lön och kassa. Samma inloggning för centralen, åkarna och förarna.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Picker() {
  const s = useSession();
  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.1 }}>Välj <i style={{ color: 'var(--green-mid)' }}>bolag</i></h2>
      <p style={{ opacity: .8, margin: '8px 0 18px', fontSize: 13.5 }}>Du har tillgång till {s.accounts.length === 1 ? 'ett bolag' : `${['', 'ett', 'två', 'tre', 'fyra', 'fem'][s.accounts.length] || s.accounts.length} bolag`}. Du kan byta när som helst uppe till vänster.</p>
      <div className="pf-pick">
        {s.accounts.map(a => (
          <Link key={a.tenant.id} to={homeFor(a)}>
            <Avatar text={a.tenant.brand?.initialer || initialer(a.tenant.name)} accent={a.tenant.brand?.accent || '#E7F0EA'} color={a.tenant.brand?.text || '#0E1E35'} />
            <span className="ba-grow"><b>{a.tenant.name}</b><small>{typText(a).replace(/ hos .*/, '')} · {ROLLNAMN[a.role]}</small></span>
            <Icon name="right" size={15} />
          </Link>
        ))}
      </div>
      <button className="ba-btn ba-btn--link" style={{ color: '#fff', marginTop: 16 }} onClick={() => s.signOut()}>Logga ut</button>
    </div>
  );
}
