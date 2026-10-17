// Les distances d'une ville en ligne de commande, avec le moteur de l'application (voir README.md).
//
//   npm run mesurer -- [--ville vahal] [--wiki] [--image sorties/controle.png] [--json sorties/resultats.json]
//
// Écrit les distances entre les repères de la configuration (en ville, par les rues puis parcs
// compris ; hors les murs), les trajets choisis, la taille des places ; --wiki ajoute les tableaux
// de trajets en syntaxe DokuWiki, prêts pour la page « distances » du wiki d'Edenya.

import './canevas-node.js';

import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { libelleDe, Reperes } from '../src/donnees/reperes.js';
import { Calculs } from '../src/moteur/calculs.js';
import { Reglages } from '../src/reglages.js';
import { tableauWiki } from '../src/vue/exports.js';
import { texteAire, texteCotes, texteDuree, texteMetres } from '../src/vue/format.js';
import { chargerVille, VILLES } from './ville.js';

const { values: options } = parseArgs({
    options: {
        ville: { type: 'string' },
        villes: { type: 'string', default: VILLES },
        wiki: { type: 'boolean', default: false },
        image: { type: 'string' },
        json: { type: 'string' },
    },
});

let ville;
try {
    ville = chargerVille(options.ville, resolve(options.villes));
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
const { cle, lieux, calques, largeur, hauteur } = ville;
const entree = { titre: ville.titre };
const reglages = new Reglages(ville.configuration);
const c = reglages.config;

// Le calcul
const debut = performance.now();
const calculs = new Calculs();
const preparation = await calculs.preparer({
    largeur, hauteur, calques, interieur: c.interieur, portes: c.portes, rayonPorte: reglages.rayonPorte, controle: false,
});
const reperes = new Reperes(lieux, c.portes);
const geometries = groupe => (c[groupe] ?? []).map(r => reperes.geometrie(r));
const resultats = { ville: cle, echelle: reglages.echelle, interieur_libre: preparation.interieurLibre, en_ville: {} };
for (const variante of ['rues', 'ouvert']) {
    resultats.en_ville[variante] = await calculs.matrice({ reperes: geometries('en_ville'), variante, marge: reglages.marge });
}
resultats.hors_les_murs = await calculs.matrice({ reperes: geometries('hors_les_murs'), variante: 'partout', marge: reglages.marge });
resultats.places = await calculs.places({ places: (c.places ?? []).map(p => ({ nom: p.nom, point: p.point, rayon: p.rayon ?? reglages.rayonPlaces })) });
const duree = ((performance.now() - debut) / 1000).toFixed(1);

// Le rapport
const largeurTexte = t => [...t].length;
const aDroite = (t, n) => ' '.repeat(Math.max(1, n - largeurTexte(t))) + t;
function tableau(titre, noms, cellule) {
    const marge = Math.max(...noms.map(largeurTexte)) + 1;
    console.log(`\n${titre}`);
    console.log(' '.repeat(marge) + noms.map(n => aDroite([...n].slice(0, 8).join(''), 9)).join(''));
    noms.forEach((nom, a) => {
        console.log(nom + ' '.repeat(marge - largeurTexte(nom)) + noms.map((_, b) => aDroite(a === b ? '×' : cellule(a, b), 9)).join(''));
    });
}
const enMetres = m => (a, b) => texteMetres(m.matrice[a][b], reglages).replace(/ m$/, '');
const allures = Object.entries(reglages.vitesses);
const [allure, kmh] = allures[0];

console.log(`${entree.titre} : 1 unité = ${String(reglages.echelle).replace('.', ',')} m ; distances en mètres (arrondies à ${reglages.arrondi} m, à 5 m sous 100 m). Calcul : ${duree} s.`);
console.log(`Sol libre à l'intérieur des murs : ${texteAire(preparation.interieurLibre, reglages)}`.replace(/ /g, ' '));
const nomsVille = (c.en_ville ?? []).map(r => r.nom);
const nomsDehors = (c.hors_les_murs ?? []).map(r => r.nom);
tableau('EN VILLE, PAR LES RUES, LES PLACES ET LES PONTS', nomsVille, enMetres(resultats.en_ville.rues));
tableau('EN VILLE, PARCS ET JARDINS OUVERTS COMPRIS', nomsVille, enMetres(resultats.en_ville.ouvert));
tableau(`MÊME CHOSE, EN MINUTES (${allure.toUpperCase()})`, nomsVille, (a, b) => {
    const u = resultats.en_ville.ouvert.matrice[a][b];
    return u === null ? '-' : ((u * reglages.echelle) / ((kmh * 1000) / 60)).toFixed(1).replace('.', ',');
});
tableau('HORS LES MURS (À TRAVERS CHAMPS, PAR LES PORTES)', nomsDehors, enMetres(resultats.hors_les_murs));
for (const [groupe, m] of [['en_ville', 'ouvert'], ['hors_les_murs', null]]) {
    const sansAcces = (m ? resultats[groupe][m] : resultats[groupe]).departs.map((n, i) => (n ? null : c[groupe][i].nom)).filter(Boolean);
    if (sansAcces.length) {
        console.log(`Sans accès (${groupe}) : ${sansAcces.join(', ')}`);
    }
}

// Les trajets choisis : à vol d'oiseau, par les rues (par les chemins hors les murs), à chaque allure
const tableauxWiki = [];
for (const [groupe, colonne, m] of [
    ['en_ville', 'Par les rues', resultats.en_ville[reglages.varianteTrajets]],
    ['hors_les_murs', 'Par les chemins', resultats.hors_les_murs],
]) {
    const paires = c.trajets?.[groupe] ?? [];
    if (!paires.length) {
        continue;
    }
    console.log(`\nTRAJETS (${groupe === 'en_ville' ? 'en ville' : 'hors les murs'})`);
    const lignes = [];
    for (const [de, vers] of paires) {
        const a = c[groupe].findIndex(r => r.nom === de);
        const b = c[groupe].findIndex(r => r.nom === vers);
        if (a < 0 || b < 0) {
            console.log(`Repère inconnu : ${a < 0 ? de : vers}`);
            continue;
        }
        const u = m.matrice[a][b];
        const ligne = [`${libelleDe(c[groupe][a])} → ${libelleDe(c[groupe][b])}`, texteMetres(m.volDOiseau[a][b], reglages), texteMetres(u, reglages),
            ...allures.map(([, v]) => texteDuree(u, v, reglages))];
        lignes.push(ligne);
        const rapport = u && m.volDOiseau[a][b] ? ` (× ${(u / m.volDOiseau[a][b]).toFixed(2)})` : '';
        console.log(`${ligne[0].padEnd(46)}${ligne.slice(1).map(t => aDroite(t.replace(/ /g, ' '), 10)).join('')}${rapport}`);
    }
    tableauxWiki.push(tableauWiki(['Trajet', "Vol d'oiseau", colonne, ...allures.map(([nom]) => nom)], lignes));
}
if (options.wiki && tableauxWiki.length) {
    console.log(`\nPOUR LE WIKI\n\n${tableauxWiki.join('\n\n')}`);
}

if (resultats.places.length) {
    console.log("\nPLACES (l'espace qui reste quand on retire tout passage de moins de deux rayons de large)");
    for (const p of resultats.places) {
        if (!p.aire) {
            console.log(`${p.nom} : introuvable`);
            continue;
        }
        const t = `${texteAire(p.aire, reglages)}, environ ${texteCotes(...p.rectangle, reglages)} (boîte ${texteCotes(p.boite[2], p.boite[3], reglages)}), rayon ${p.rayon * reglages.echelle} m`;
        console.log(`${p.nom.padEnd(20)} ${t.replace(/ /g, ' ')}`);
    }
}

function ecrire(chemin, contenu) {
    const fichier = resolve(chemin);
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, contenu);
    console.log(`\nÉcrit : ${fichier}`);
}

if (options.json) {
    const sansChemins = m => ({ noms: m.noms, departs: m.departs, matrice: m.matrice, vol_d_oiseau: m.volDOiseau });
    ecrire(options.json, JSON.stringify({
        ...resultats,
        en_ville: Object.fromEntries(Object.entries(resultats.en_ville).map(([v, m]) => [v, sansChemins({ ...m, noms: nomsVille })])),
        hors_les_murs: sansChemins({ ...resultats.hors_les_murs, noms: nomsDehors }),
        places: resultats.places.map(({ masque, ...p }) => p),
    }, null, 4) + '\n');
}

// L'image de contrôle : rues en clair, intérieur des murs en gris clair, chemins en vert, repères en rouge
if (options.image) {
    const toile = createCanvas(largeur, hauteur);
    const g = toile.getContext('2d');
    g.putImageData(calculs.imageDesClasses({ infranchissable: [60, 60, 60, 255], dehors: [165, 165, 165, 255], interieur: [205, 205, 205, 255], rue: [235, 235, 205, 255] }), 0, 0);
    g.strokeStyle = 'rgba(0, 120, 0, 0.8)';
    g.lineWidth = 3;
    for (const m of [resultats.en_ville[reglages.varianteTrajets], resultats.hors_les_murs]) {
        m.chemins.forEach((ligne, a) => ligne.forEach((points, b) => {
            if (!points || b < a) {
                return;
            }
            g.beginPath();
            for (let i = 0; i < points.length; i += 2) {
                g[i ? 'lineTo' : 'moveTo'](points[i], points[i + 1]);
            }
            g.stroke();
        }));
    }
    g.fillStyle = '#c00';
    g.font = 'bold 20px sans-serif';
    for (const geo of [...geometries('en_ville'), ...geometries('hors_les_murs')]) {
        const [x, y] = geo.point ?? geo.cercle ?? geo.poly.reduce(([sx, sy], [px, py], _, t) => [sx + px / t.length, sy + py / t.length], [0, 0]);
        g.fillRect(x - 4, y - 4, 8, 8);
        g.fillText(geo.nom, x + 6, y - 6);
    }
    ecrire(options.image, await toile.encode('png'));
}
