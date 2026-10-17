// Exporte du jeu ce dont l'application a besoin pour une ville (voir README.md) : une copie du
// dessin du plan, les noms des quartiers, les lieux sans bâtiment et les contours des bâtiments,
// reportés en unités du plan. Écrit dans public/villes/<ville>/ et tient public/villes/villes.json
// à jour. La configuration de la ville (public/villes/<ville>/configuration.json) existe déjà.
//
//   npm run exporter -- --edenya <dépôt d'Edenya> [--ville vahal]
//
// Les vues des secteurs et les lieux sans bâtiment sont lus dans Carte.php (Carte::$plans), les
// bâtiments et les quartiers dans la base Docker du jeu (docker compose up -d dans son dépôt) : la
// ville est la clé « ville » de la configuration, la base sa clé « base ». Sans --edenya, la
// variable EDENYA, puis le dossier qui contient ce projet s'il est dans le .temp/ du jeu.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const projet = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const villesDossier = join(projet, 'public/villes');
const { values: options } = parseArgs({
    options: {
        ville: { type: 'string', default: 'vahal' },
        edenya: { type: 'string', default: process.env.EDENYA ?? resolve(projet, '../..') },
    },
});

function arreter(message) {
    console.error(message);
    process.exit(1);
}

const donnees = join(villesDossier, options.ville);
const fichierConfig = join(donnees, 'configuration.json');
if (!existsSync(fichierConfig)) {
    arreter(`Pas de configuration pour « ${options.ville} » : écrire d'abord ${relative(process.cwd(), fichierConfig)} (en partant de celle de Vahal).`);
}
const config = JSON.parse(readFileSync(fichierConfig, 'utf8'));
const racine = resolve(options.edenya);
const fichierCarte = join(racine, '_engine/src/Lieu/Carte.php');
if (!existsSync(fichierCarte)) {
    arreter(`${racine} n'est pas un dépôt d'Edenya (pas de _engine/src/Lieu/Carte.php) : --edenya <dépôt d'Edenya>`);
}
const plan = lirePlan(readFileSync(fichierCarte, 'utf8'), options.ville);

// Le plan d'une ville dans Carte::$plans : son dossier, les vues de ses secteurs, ses lieux sans bâtiment
function lirePlan(source, nom) {
    for (const bloc of source.split(/'dossier'\s*=>\s*/).slice(1)) {
        const dossier = bloc.match(/^'([^']+)'/)?.[1];
        if (bloc.match(/'nom'\s*=>\s*'([^']+)'/)?.[1] !== nom) {
            continue;
        }
        const [secteursBloc, lieuxBloc = ''] = bloc.split(/'lieux'\s*=>\s*\[/);
        const secteurs = {};
        for (const [, code, valeurs] of secteursBloc.matchAll(/'([A-Z]{2})'\s*=>\s*\[([\d.,\s-]+)\]/g)) {
            secteurs[code] = valeurs.split(',').map(Number);
        }
        const lieux = lieuxBloc.split(/\[\s*'secteur'\s*=>/).slice(1).map(texte => ({
            secteur: texte.match(/^\s*'([A-Z]{2})'/)?.[1],
            forme: texte.match(/'forme'\s*=>\s*'(\w+)'/)?.[1],
            coords: texte.match(/'coords'\s*=>\s*'([^']+)'/)?.[1],
            titre: chainePhp(texte.match(/'titre'\s*=>\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)?.[1]),
            batiment: texte.match(/'batiment'\s*=>\s*\[\s*'([A-Z]{2})',\s*(\d+)\s*\]/)?.slice(1, 3),
        }));
        if (!Object.keys(secteurs).length || lieux.some(l => !l.secteur || !l.forme || !l.coords || !l.titre)) {
            arreter(`Carte.php : le plan « ${nom} » ne se lit plus (vues des secteurs ou lieux)`);
        }
        return { dossier, nom, secteurs, lieux };
    }
    arreter(`Carte.php : pas de plan « ${nom} » dans Carte::$plans`);
}

function chainePhp(litteral) {
    if (!litteral) {
        return undefined;
    }
    const corps = litteral.slice(1, -1);
    return litteral[0] === "'" ? corps.replace(/\\(['\\])/g, '$1') : corps.replace(/\\(["\\$])/g, '$1');
}

// Carte::points() et Carte::cercle() : des coordonnées saisies dans la vue d'un secteur, reportées sur le plan
const nombre = v => Math.round(v * 10) / 10;
function points(secteur, coords) {
    const vue = plan.secteurs[secteur];
    const v = (coords ?? '').split(',').map(Number);
    if (!vue || v.length < 6 || v.length % 2 || v.some(Number.isNaN)) {
        return null;
    }
    const [x, y, l, h, al, ah] = vue;
    const poly = [];
    for (let i = 0; i < v.length; i += 2) {
        poly.push([nombre(x + v[i] * l / al), nombre(y + v[i + 1] * h / ah)]);
    }
    return poly;
}
function cercle(secteur, coords) {
    const vue = plan.secteurs[secteur];
    const v = coords.split(',').map(Number);
    if (!vue || v.length !== 3) {
        return null;
    }
    const [x, y, l, h, al, ah] = vue;
    return [nombre(x + v[0] * l / al), nombre(y + v[1] * h / ah), nombre(v[2] * (l / al + h / ah) / 2)];
}

// Une requête à la base Docker, une ligne JSON par rangée
function requete(sql) {
    const base = config.base ?? 'edenya_v4';
    const r = spawnSync('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c',
        `mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 -N --raw ${base}`],
        { cwd: racine, input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) {
        arreter(`La base Docker ne répond pas (docker compose up -d) :\n${r.error?.message ?? r.stderr}`);
    }
    return r.stdout.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

const lieuId = parseInt(config.ville, 10);
const quartiers = {};
for (const q of requete(`SELECT JSON_OBJECT('code', secteur_code, 'nom', secteur_nom) FROM secteur WHERE lieu_id = ${lieuId} ORDER BY secteur_id;`)) {
    quartiers[q.code] = q.nom;
}
const batiments = [];
for (const b of requete(`SELECT JSON_OBJECT('secteur', b.batiment_secteur, 'numero', b.batiment_secteur_id,
        'nom', COALESCE(b.batiment_nom, c.commerce_nom, g.guilde_nom), 'type', b.batiment_type,
        'public', b.batiment_public, 'coords', b.batiment_coords)
    FROM batiment b
    LEFT JOIN commerce c ON c.commerce_id = b.commerce_id
    LEFT JOIN guilde g ON g.guilde_id = b.guilde_id
    WHERE b.lieu_id = ${lieuId} AND b.batiment_coords <> ''
    ORDER BY b.batiment_secteur, b.batiment_secteur_id;`)) {
    const poly = points(b.secteur, b.coords);
    if (poly) {
        batiments.push({ secteur: b.secteur, numero: b.numero, nom: b.nom, type: b.type, public: Boolean(b.public), poly });
    }
}
const lieux = plan.lieux.map(l => ({
    titre: l.titre,
    secteur: l.secteur,
    ...(l.batiment ? { batiment: [l.batiment[0], Number(l.batiment[1])] } : {}),
    ...(l.forme === 'cercle' ? { cercle: cercle(l.secteur, l.coords) } : { poly: points(l.secteur, l.coords) }),
})).filter(l => l.cercle ?? l.poly);

// Le dessin, copié tel quel, et ses dimensions
const source = join(racine, '_game', plan.dossier, `${plan.nom}.svg`);
const dessin = readFileSync(source, 'utf8');
const viewBox = dessin.match(/viewBox="([^"]+)"/)?.[1].split(/[\s,]+/).map(Number);
if (!viewBox) {
    arreter(`${source} : pas de viewBox`);
}
mkdirSync(donnees, { recursive: true });
copyFileSync(source, join(donnees, 'plan.svg'));

// Un objet par ligne : le fichier reste lisible et se compare bien
const ligne = v => JSON.stringify(v);
const liste = t => (t.length ? `[\n    ${t.map(ligne).join(',\n    ')}\n  ]` : '[]');
writeFileSync(join(donnees, 'lieux.json'), `{
  "ville": ${ligne(String(config.ville))},
  "exporte": ${ligne(new Date().toISOString())},
  "largeur": ${viewBox[2]},
  "hauteur": ${viewBox[3]},
  "quartiers": ${ligne(quartiers)},
  "lieux": ${liste(lieux)},
  "batiments": ${liste(batiments)}
}
`);

const fichierVilles = join(villesDossier, 'villes.json');
const villes = existsSync(fichierVilles) ? JSON.parse(readFileSync(fichierVilles, 'utf8')) : {};
const titre = dessin.match(/<title>(?:Plan de )?([^<]+)<\/title>/)?.[1] ?? plan.nom;
villes[options.ville] = {
    titre,
    configuration: `${options.ville}/configuration.json`,
    dessin: `${options.ville}/plan.svg`,
    lieux: `${options.ville}/lieux.json`,
};
writeFileSync(fichierVilles, JSON.stringify(villes, null, 4) + '\n');

console.log(`${titre} : ${batiments.length} bâtiments, ${lieux.length} lieux, ${Object.keys(quartiers).length} quartiers, plan ${viewBox[2]} × ${viewBox[3]} unités.`);
console.log(`Écrit dans ${relative(process.cwd(), donnees) || '.'} : plan.svg, lieux.json ; ${relative(process.cwd(), fichierVilles)} à jour.`);
