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
  integrations: [sitemap()],
  build: {
    // Každá stránka jako složka s index.html — hezké adresy bez .html
    format: 'directory',
  },
  image: {
    // Portréty a fotky města zpracovává Astro samo do avif/webp
    responsiveStyles: true,
  },
});
