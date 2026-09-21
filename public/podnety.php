<?php
/**
 * Úložiště podnětů sbíraných na stánku.
 *
 * Web je jinak statický — hotové soubory na disku, žádný server, žádná
 * databáze. Body se ale musí sdílet mezi zařízeními, aby na stánku viděli
 * všichni totéž, takže jedno místo, které umí zapisovat, tu být musí.
 * Tohle je to nejmenší možné: jeden soubor PHP a jeden soubor s daty.
 *
 * Běží na témže hostingu jako web, takže se nikam ven neposílá nic a platí
 * dál, že web nesahá na cizí servery.
 *
 * ---------------------------------------------------------------------------
 * CO JE POTŘEBA UDĚLAT RUČNĚ, JEDNOU
 *
 * Vedle složky webu (o patro výš, mimo to, co je vidět z internetu) založte
 * přes FTP složku `podnety-data` a v ní soubor `heslo.txt` s jedním řádkem —
 * heslem, které se pak zadává na stánku. Bez toho souboru se nic neuloží
 * ani nepřečte a skript to rovnou řekne.
 *
 * Heslo schválně není v repozitáři: ten je veřejný.
 * ---------------------------------------------------------------------------
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

/** Odpoví a skončí. */
function odpoved(array $telo, int $stav = 200): void {
    http_response_code($stav);
    echo json_encode($telo, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Kde leží data.
 *
 * Nejdřív se zkouší složka o patro nad webem. Tam se k souboru nikdo přes
 * prohlížeč nedostane, i kdyby adresu uhodl. Když tam zapisovat nejde,
 * použije se složka uvnitř webu — a data se proto ukládají do souboru
 * s příponou `.php`, který začíná `exit`. Kdyby si ho někdo vyžádal,
 * server ho spustí a vrátí prázdno místo obsahu.
 */
function slozkaDat(): string {
    foreach ([__DIR__ . '/../podnety-data', __DIR__ . '/podnety-data'] as $kde) {
        if (is_dir($kde) && is_writable($kde)) return $kde;
    }
    foreach ([__DIR__ . '/../podnety-data', __DIR__ . '/podnety-data'] as $kde) {
        if (@mkdir($kde, 0750, true) || is_dir($kde)) {
            if (is_writable($kde)) return $kde;
        }
    }
    odpoved(['ok' => false, 'chyba' => 'Nejde založit složku pro data. Založte ji přes FTP.'], 500);
}

const ZACATEK_SOUBORU = "<?php exit; ?>\n";

const KATEGORIE = [
    'Hospodaření', 'Bydlení', 'Zeleň a voda', 'Doprava',
    'Školství', 'Kultura', 'Podnikání', 'Bezpečnost', 'Ostatní',
];

/** Výřez mapy obce. Bod mimo něj by se na mapě nevykreslil. */
const VYREZ = ['jih' => 49.2542, 'sever' => 49.3388, 'zapad' => 16.8995, 'vychod' => 17.0327];

const NEJVIC_BODU = 5000;
const NEJDELSI_POPIS = 500;

$slozka = slozkaDat();
$souborDat = $slozka . '/body.php';
$souborHesla = $slozka . '/heslo.txt';

// --- Heslo -----------------------------------------------------------------

if (!is_file($souborHesla)) {
    odpoved([
        'ok' => false,
        'chyba' => 'Na serveru chybí soubor s heslem (podnety-data/heslo.txt). Sběr zatím nejde používat.',
    ], 503);
}

$spravneHeslo = trim((string) file_get_contents($souborHesla));
if ($spravneHeslo === '') {
    odpoved(['ok' => false, 'chyba' => 'Soubor s heslem je prázdný.'], 503);
}

$vstup = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($vstup)) $vstup = [];

// `hash_equals` porovnává v konstantním čase. Porovnání přes `===` prozradí
// délkou výpočtu, kolik znaků hesla sedí, a dá se tím heslo uhodnout po
// písmenech.
if (!hash_equals($spravneHeslo, (string) ($vstup['heslo'] ?? ''))) {
    odpoved(['ok' => false, 'chyba' => 'Špatné heslo.'], 401);
}

// --- Data ------------------------------------------------------------------

/** Načte body. Zamyká, aby se nečetlo uprostřed zápisu. */
function nactiBody(string $soubor): array {
    if (!is_file($soubor)) return [];
    $ruka = fopen($soubor, 'r');
    if (!$ruka) return [];
    flock($ruka, LOCK_SH);
    $text = stream_get_contents($ruka);
    flock($ruka, LOCK_UN);
    fclose($ruka);

    $json = substr($text, strlen(ZACATEK_SOUBORU));
    $body = json_decode($json, true);
    return is_array($body) ? $body : [];
}

/** Zapíše body. Nejdřív vedle, pak přejmenuje — při pádu uprostřed zápisu
    by jinak zůstal poloviční soubor a přišli bychom o všechno. */
function zapisBody(string $soubor, array $body): bool {
    $docasny = $soubor . '.' . getmypid() . '.tmp';
    $text = ZACATEK_SOUBORU . json_encode(array_values($body), JSON_UNESCAPED_UNICODE);
    if (file_put_contents($docasny, $text, LOCK_EX) === false) return false;
    return rename($docasny, $soubor);
}

// --- Akce ------------------------------------------------------------------

$akce = (string) ($vstup['akce'] ?? 'nacti');

if ($akce === 'nacti') {
    odpoved(['ok' => true, 'body' => nactiBody($souborDat)]);
}

if ($akce === 'pridej') {
    $bod = $vstup['bod'] ?? null;
    if (!is_array($bod)) odpoved(['ok' => false, 'chyba' => 'Chybí bod.'], 400);

    $lat = (float) ($bod['lat'] ?? 0);
    $lon = (float) ($bod['lon'] ?? 0);
    if ($lat < VYREZ['jih'] || $lat > VYREZ['sever'] || $lon < VYREZ['zapad'] || $lon > VYREZ['vychod']) {
        odpoved(['ok' => false, 'chyba' => 'Bod leží mimo mapu Vyškova.'], 400);
    }

    $kategorie = (string) ($bod['kategorie'] ?? '');
    if (!in_array($kategorie, KATEGORIE, true)) {
        odpoved(['ok' => false, 'chyba' => 'Neznámá kategorie.'], 400);
    }

    $popis = trim((string) ($bod['popis'] ?? ''));
    if ($popis === '') odpoved(['ok' => false, 'chyba' => 'Popis nesmí být prázdný.'], 400);
    if (mb_strlen($popis) > NEJDELSI_POPIS) $popis = mb_substr($popis, 0, NEJDELSI_POPIS);

    $body = nactiBody($souborDat);
    if (count($body) >= NEJVIC_BODU) {
        odpoved(['ok' => false, 'chyba' => 'Bodů je už příliš mnoho.'], 409);
    }

    $novy = [
        'id' => bin2hex(random_bytes(8)),
        'lat' => round($lat, 6),
        'lon' => round($lon, 6),
        'kategorie' => $kategorie,
        'popis' => $popis,
        'kdy' => gmdate('c'),
    ];
    $body[] = $novy;

    if (!zapisBody($souborDat, $body)) {
        odpoved(['ok' => false, 'chyba' => 'Bod se nepodařilo uložit.'], 500);
    }
    odpoved(['ok' => true, 'bod' => $novy]);
}

if ($akce === 'smaz') {
    $id = (string) ($vstup['id'] ?? '');
    if ($id === '') odpoved(['ok' => false, 'chyba' => 'Chybí id.'], 400);

    $body = nactiBody($souborDat);
    $zbyle = array_filter($body, fn($b) => ($b['id'] ?? '') !== $id);
    if (count($zbyle) === count($body)) {
        odpoved(['ok' => false, 'chyba' => 'Takový bod tu není.'], 404);
    }
    if (!zapisBody($souborDat, $zbyle)) {
        odpoved(['ok' => false, 'chyba' => 'Smazání se nepodařilo uložit.'], 500);
    }
    odpoved(['ok' => true]);
}

odpoved(['ok' => false, 'chyba' => 'Neznámá akce.'], 400);
