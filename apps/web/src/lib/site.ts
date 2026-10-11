// Gemensamt innehåll. Branscherna läses från Markdown i src/content/bransch.
export const APP = import.meta.env.PUBLIC_APP_URL || 'https://bolagsappar.se/app';

type Md = { frontmatter: Record<string, any>; Content: any; file: string };
const bransch = import.meta.glob<Md>('../content/bransch/*.md', { eager: true });
const kundcase = import.meta.glob<Md>('../content/kundcase/*.md', { eager: true });
const slug = (f: string) => f.split('/').pop()!.replace(/\.md$/, '');

export const BRANSCHER = Object.entries(bransch).map(([f, m]) => ({ slug: slug(f), ...m.frontmatter, Content: m.Content } as any)).sort((a: any, b: any) => a.ordning - b.ordning);
export const KUNDCASE = Object.entries(kundcase).map(([f, m]) => ({ slug: slug(f), ...m.frontmatter, Content: m.Content } as any));
