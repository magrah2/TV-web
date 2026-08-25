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
 *
 * POZOR: všechno, co se vypisuje do terminálu, je **bez diakritiky**.
 * Windows konzole běží ve starším kódování a české znaky v ní vycházejí
 * jako klikyháky. Komentáře ve zdroji diakritiku mít můžou — ty se čtou
 * v editoru, ne v konzoli.
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
 * Každý z obou programů potřebuje něco jiného a záměna nefunguje:
 *
 * - **npm** je na Windows dávkový soubor a Node ho od verze 20 odmítá spustit
 *   napřímo (bezpečnostní oprava kvůli CVE-2024-27980). Musí přes shell.
 *   Celý příkaz se předává jako jeden řetězec bez pole argumentů — jinak
 *   Node hlásí, že se argumenty do shellu nedají bezpečně předat.
 * - **git** přes shell jít nesmí. Zpráva commitu obsahuje mezery a shell
 *   by ji roztrhal na jednotlivá slova.
 *
 * Výstup se ořezává jen zprava. Kdyby se ořezal i zleva, první řádek
 * `git status --porcelain` by přišel o úvodní mezeru a název souboru
 * by se pak vypsal o písmeno kratší.
 */
function spust(prikaz, argumenty, { tise = false } = {}) {
  const nastaveni = {
    stdio: tise ? 'pipe' : 'inherit',
    encoding: 'utf8',
  };

  const vysledek =
    prikaz === 'npm'
      ? spawnSync(`npm ${argumenty.join(' ')}`, { ...nastaveni, shell: true })
      : spawnSync(prikaz, argumenty, nastaveni);

  const zprava = (text) => (text ?? '').replace(/\s+$/, '');

  return {
    ok: vysledek.status === 0,
    vystup: zprava(vysledek.stdout),
    chyba: zprava(vysledek.stderr),
  };
}

// ---------------------------------------------------------------------------
// 1. Je vůbec co zveřejňovat?
// ---------------------------------------------------------------------------

const zmeny = spust('git', ['status', '--porcelain'], { tise: true });
if (!zmeny.ok) {
  skonci('Nepodarilo se precist stav projektu.', 'Je nainstalovany Git?');
}

const nezverejnene = spust('git', ['log', '--oneline', '@{u}..HEAD'], { tise: true });
const maNeodeslaneCommity = nezverejnene.ok && nezverejnene.vystup.length > 0;

if (!zmeny.vystup && !maNeodeslaneCommity) {
  krok('Neni co zverejnovat - vsechno je uz odeslane.');
  process.exit(0);
}

if (zmeny.vystup) {
  krok('Nasel jsem tyhle zmeny:');
  for (const radek of zmeny.vystup.split('\n')) {
    info(radek.slice(3));
  }
}

// ---------------------------------------------------------------------------
// 2. Sestavit — kontrola, že se web vůbec poskládá
// ---------------------------------------------------------------------------

krok('Zkousim web sestavit, aby se nezverejnilo neco rozbiteho.');

const sestaveni = spust('npm', ['run', 'build']);
if (!sestaveni.ok) {
  skonci(
    'Web se nepodarilo sestavit, takze jsem nic neodeslal.',
    'Chyba je vypsana kousek vys. Nejcasteji je to preklep v souboru\n' +
      '   kandidata - treba tema, ktere neni v seznamu. Opravte to a spustte\n' +
      '   ulohu znovu. Kdyz si nebudete vedet rady, zavolejte Vojtu.',
  );
}

hotovo('Web se sestavil bez chyby.');

// ---------------------------------------------------------------------------
// 3. Uložit změny
// ---------------------------------------------------------------------------

if (zmeny.vystup) {
  krok('Ukladam zmeny.');

  if (!spust('git', ['add', '-A']).ok) {
    skonci('Nepodarilo se zmeny pripravit k ulozeni.');
  }

  // Zpráva se sestaví z toho, co se skutečně změnilo, ať se v historii
  // dá zpětně poznat, o co šlo. Tahle jde do souboru, ne do terminálu,
  // takže diakritiku mít může.
  const zprava = sestavZpravu(zmeny.vystup);
  const ulozeni = spust('git', ['commit', '-m', zprava], { tise: true });

  if (!ulozeni.ok && !ulozeni.vystup.includes('nothing to commit')) {
    skonci('Nepodarilo se zmeny ulozit.', ulozeni.chyba || ulozeni.vystup);
  }

  hotovo('Ulozeno.');
}

// ---------------------------------------------------------------------------
// 4. Stáhnout cizí změny a odeslat
// ---------------------------------------------------------------------------

krok('Stahuji, co mezitim zmenili ostatni.');

const stazeni = spust('git', ['pull', '--rebase'], { tise: true });
if (!stazeni.ok) {
  skonci(
    'Vase zmeny se stretly se zmenami nekoho jineho.',
    'Tohle uz neumim rozhodnout za vas - zavolejte Vojtu.\n' +
      '   Nic se neztratilo, jen to potrebuje rucni srovnani.',
  );
}

krok('Odesilam na GitHub.');

if (!spust('git', ['push']).ok) {
  skonci('Odeslani se nepovedlo.', 'Zkontrolujte pripojeni k internetu a zkuste to znovu.');
}

console.log(`\n${ZELENA}   Hotovo.${KONEC}`);
info('Nasazeni ted bezi samo a trva dve az tri minuty.');
info('Pak se zmeny objevi na nahledovem webu.');
info('');
info('Prubeh vidite na https://github.com/magrah2/TP-web/actions');

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
