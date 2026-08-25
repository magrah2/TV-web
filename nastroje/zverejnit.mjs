/**
 * Zveřejní web — sestaví ho, uloží změny a odešle na GitHub.
 * Tam si je převezme automatické nasazení a za pár minut je draft aktuální.
 *
 *   npm run zverejnit
 *
 * Pořadí kroků není náhodné: **nejdřív sestavení, potom odeslání.**
 * Když je v datech chyba (třeba překlep v tématu u kandidáta), sestavení
 * spadne tady a nic se neodešle. Kdyby se odesílalo první, chyba by se
 * projevila až na GitHubu, kde si jí nikdo nevšimne.
 */

import { spawnSync } from 'node:child_process';

const ZELENA = '\x1b[32m';
const CERVENA = '\x1b[31m';
const MODRA = '\x1b[36m';
const SEDA = '\x1b[90m';
const KONEC = '\x1b[0m';

const krok = (text) => console.log(`\n${MODRA}>> ${text}${KONEC}`);
const info = (text) => console.log(`${SEDA}   ${text}${KONEC}`);
const hotovo = (text) => console.log(`${ZELENA}   ${text}${KONEC}`);

function skonci(duvod, rada) {
  console.log(`\n${CERVENA}!! ${duvod}${KONEC}`);
  if (rada) console.log(`   ${rada}`);
  process.exit(1);
}

/**
 * Spustí příkaz a vrátí jeho výstup. `tise` = výstup se nevypisuje na obrazovku.
 *
 * Shell se zapíná **jen pro npm** a jen na Windows, kde je npm dávkový soubor
 * a jinak by se nespustil. Pro git shell zapnutý být nesmí: zpráva commitu
 * obsahuje mezery a shell by ji roztrhal na jednotlivá slova.
 */
function spust(prikaz, argumenty, { tise = false } = {}) {
  const potrebujeShell = process.platform === 'win32' && prikaz === 'npm';
  const vysledek = spawnSync(prikaz, argumenty, {
    stdio: tise ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: potrebujeShell,
  });
  return {
    ok: vysledek.status === 0,
    vystup: (vysledek.stdout ?? '').trim(),
    chyba: (vysledek.stderr ?? '').trim(),
  };
}

// ---------------------------------------------------------------------------
// 1. Je vůbec co zveřejňovat?
// ---------------------------------------------------------------------------

const zmeny = spust('git', ['status', '--porcelain'], { tise: true });
if (!zmeny.ok) {
  skonci('Nepodařilo se přečíst stav projektu.', 'Je nainstalovaný Git?');
}

const nezverejnene = spust('git', ['log', '--oneline', '@{u}..HEAD'], { tise: true });
const maNeodeslaneCommity = nezverejnene.ok && nezverejnene.vystup.length > 0;

if (!zmeny.vystup && !maNeodeslaneCommity) {
  krok('Není co zveřejňovat — všechno je už odeslané.');
  process.exit(0);
}

if (zmeny.vystup) {
  krok('Našel jsem tyhle změny:');
  for (const radek of zmeny.vystup.split('\n')) {
    info(radek.slice(3));
  }
}

// ---------------------------------------------------------------------------
// 2. Sestavit — kontrola, že se web vůbec poskládá
// ---------------------------------------------------------------------------

krok('Zkouším web sestavit, aby se nezveřejnilo něco rozbitého.');

const sestaveni = spust('npm', ['run', 'build']);
if (!sestaveni.ok) {
  skonci(
    'Web se nepodařilo sestavit, takže jsem nic neodeslal.',
    'Chyba je vypsaná kousek výš. Nejčastěji je to překlep v souboru\n' +
      '   kandidáta — třeba téma, které není v seznamu. Opravte to a spusťte\n' +
      '   úlohu znovu. Když si nebudete vědět rady, zavolejte Vojtu.',
  );
}

hotovo('Web se sestavil bez chyby.');

// ---------------------------------------------------------------------------
// 3. Uložit změny
// ---------------------------------------------------------------------------

if (zmeny.vystup) {
  krok('Ukládám změny.');

  if (!spust('git', ['add', '-A']).ok) {
    skonci('Nepodařilo se změny připravit k uložení.');
  }

  // Zpráva se sestaví z toho, co se skutečně změnilo, ať se v historii
  // dá zpětně poznat, o co šlo.
  const zprava = sestavZpravu(zmeny.vystup);
  const ulozeni = spust('git', ['commit', '-m', zprava], { tise: true });

  if (!ulozeni.ok && !ulozeni.vystup.includes('nothing to commit')) {
    skonci('Nepodařilo se změny uložit.', ulozeni.chyba || ulozeni.vystup);
  }

  hotovo(`Uloženo jako: ${zprava}`);
}

// ---------------------------------------------------------------------------
// 4. Stáhnout cizí změny a odeslat
// ---------------------------------------------------------------------------

krok('Stahuji, co mezitím změnili ostatní.');

const stazeni = spust('git', ['pull', '--rebase'], { tise: true });
if (!stazeni.ok) {
  skonci(
    'Vaše změny se střetly se změnami někoho jiného.',
    'Tohle už neumím rozhodnout za vás — zavolejte Vojtu.\n' +
      '   Nic se neztratilo, jen to potřebuje ruční srovnání.',
  );
}

krok('Odesílám na GitHub.');

if (!spust('git', ['push']).ok) {
  skonci('Odeslání se nepovedlo.', 'Zkontrolujte připojení k internetu a zkuste to znovu.');
}

console.log(`\n${ZELENA}   Hotovo.${KONEC}`);
info('Nasazení teď běží samo a trvá dvě až tři minuty.');
info('Pak se změny objeví na náhledovém webu.');
info('');
info('Průběh vidíte na https://github.com/magrah2/TP-web/actions');

// ---------------------------------------------------------------------------

/** Ze seznamu změněných souborů udělá srozumitelnou zprávu do historie. */
function sestavZpravu(stav) {
  const soubory = stav
    .split('\n')
    .map((radek) => radek.slice(3).trim().replace(/^"|"$/g, ''));

  const kandidati = new Set();
  const oblasti = new Set();
  let jineZmeny = false;

  for (const soubor of soubory) {
    const kandidat = soubor.match(/src\/content\/kandidati\/\d+-(.+)\.md$/);
    const oblast = soubor.match(/src\/content\/program\/\d+-(.+)\.md$/);
    const foto = soubor.match(/src\/assets\/portrety\//);

    if (kandidat) kandidati.add(kandidat[1].replace(/-/g, ' '));
    else if (oblast) oblasti.add(oblast[1].replace(/-/g, ' '));
    else if (foto) kandidati.add('fotky');
    else jineZmeny = true;
  }

  const casti = [];
  if (kandidati.size) casti.push(`kandidáti: ${[...kandidati].join(', ')}`);
  if (oblasti.size) casti.push(`program: ${[...oblasti].join(', ')}`);
  if (jineZmeny) casti.push('úpravy webu');

  const zprava = `Web: ${casti.join(' · ')}`;
  // Příliš dlouhá zpráva se v historii stejně ořízne.
  return zprava.length > 100 ? `${zprava.slice(0, 97)}...` : zprava;
}
