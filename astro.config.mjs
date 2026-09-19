// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Draft běží na GitHub Pages v podsložce, ostrý web na vlastní doméně v kořeni.
// Přepíná se proměnnou prostředí, aby se nemuselo sahat do odkazů.
const naostro = process.env.NAOSTRO === '1';

export default defineConfig({
  site: naostro ? 'https://transparentnivyskov.cz' : 'https://magrah2.github.io',
  base: naostro ? '/' : '/TV-web',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Stránka pro stánek se nikde neodkazuje a nemá co dělat ve
      // vyhledávačích. Mapa webu je první místo, kam se roboti dívají,
      // takže by ji tam našli dřív než kdekoliv jinde.
      filter: (adresa) => !adresa.includes('/stanek/'),
    }),
  ],
  build: {
    // Každá stránka jako složka s index.html — hezké adresy bez .html
    format: 'directory',
  },
  image: {
    // Portréty a fotky města zpracovává Astro samo do avif/webp
    responsiveStyles: true,
  },
  vite: {
    build: {
      // Knihovna map (MapLibre) má přes 500 kB a Vite kvůli tomu hlásí
      // varování. Je to vědomé rozhodnutí, ne přehlédnutí: mapa je vektorová
      // a skládá ji prohlížeč. Načítá se jen na třech stránkách, které mapu
      // mají, a sdílí se mezi nimi. Varování se tedy umlčí, ať je v sestavení
      // vidět jen to, co je skutečně potřeba spravit.
      chunkSizeWarningLimit: 900,
    },
  },
});
