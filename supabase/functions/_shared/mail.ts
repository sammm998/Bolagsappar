// E-post via Resend (RESEND_API_KEY). Utan nyckel loggas mejlet bara, så att utveckling fungerar utan utskick.
export async function sendMail({ to, subject, text }: { to: string[]; subject: string; text: string }) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') || 'Bolagsappar <noreply@bolagsappar.se>';
  if (!key || !to.length) { console.log('mejl (skickas inte utan RESEND_API_KEY)', { to, subject }); return { sent: false }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text })
  });
  if (!r.ok) throw new Error('Mejlet kunde inte skickas: ' + r.status);
  return { sent: true };
}

const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const manadAr = (p: string) => MAN[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4);
