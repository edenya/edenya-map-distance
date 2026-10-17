// Le moteur sous Node (le dessin rendu par @napi-rs/canvas) : un petit plan fait main, puis Vahal,
// dont les distances doivent rester celles que Chrome a calculées pour le wiki (17 octobre 2026).

import '../outils/canevas-node.js';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Reperes } from '../src/donnees/reperes.js';
import { Calculs } from '../src/moteur/calculs.js';
import { chargerVille } from '../outils/ville.js';

const proche = (valeur, attendue, tolerance, message) =>
    assert.ok(Math.abs(valeur - attendue) <= tolerance, `${message} : ${valeur} au lieu de ${attendue} ± ${tolerance}`);

test("un mur se contourne par son bout, jamais à travers", async () => {
    const calculs = new Calculs();
    await calculs.preparer({
        largeur: 200, hauteur: 100, interieur: [20, 20], portes: {}, rayonPorte: 30, controle: false,
        calques: { rues: ['M0 0H200V100H0Z'], ponts: [], obstacles: ['M95 0H105V80H95Z'], murs: [], eau: [] },
    });
    const reperes = [{ cle: 'a', nom: 'A', point: [20, 20] }, { cle: 'b', nom: 'B', point: [180, 20] }];
    const m = await calculs.matrice({ reperes, variante: 'rues', marge: 6 });
    proche(m.volDOiseau[0][1], 160, 0.5, "à vol d'oiseau");
    // par le bout du mur : 95,6 + 11 + 95,9 unités environ
    proche(m.matrice[0][1], 202.5, 6, 'par les rues');
    assert.equal(m.matrice[0][1], m.matrice[1][0]);
});

test("un itinéraire entre dans un bâtiment et en ressort par la même porte", async () => {
    const calculs = new Calculs();
    await calculs.preparer({
        largeur: 300, hauteur: 100, interieur: [20, 20], portes: {}, rayonPorte: 30, controle: false,
        calques: { rues: ['M0 0H300V100H0Z'], ponts: [], obstacles: ['M130 20H170V80H130Z'], murs: [], eau: [] },
    });
    const a = { cle: 'a', nom: 'A', point: [20, 50] };
    const maison = { cle: 'm', nom: 'Maison', poly: [[130, 20], [170, 20], [170, 80], [130, 80]] };
    const c = { cle: 'c', nom: 'C', point: [280, 50] };
    const r = calculs.itineraire({ etapes: [a, maison, c], variante: 'rues', marge: 6 });
    // par deux portes, on la traverserait (environ 104 + 104) ; par une seule, on la longe
    // jusqu'au milieu d'un de ses côtés et l'on revient : 2 × √(130² + 36²) ≈ 270
    proche(r.distance, 270, 8, 'A → maison → C');
    proche(r.troncons[0].distance + r.troncons[1].distance, r.distance, 0.2, 'la somme des tronçons');
    assert.equal(r.troncons.length, 2);
    assert.ok(r.troncons.every(t => t.chemin?.length >= 4), 'chaque tronçon a son chemin');
    // le premier tronçon finit là où le second commence : à la même porte
    const fin = r.troncons[0].chemin.slice(0, 2);
    const debut = r.troncons[1].chemin.slice(-2);
    assert.deepEqual([...fin], [...debut]);
});

test("un itinéraire de deux étapes est le trajet du tableau", async () => {
    const calculs = new Calculs();
    await calculs.preparer({
        largeur: 200, hauteur: 100, interieur: [20, 20], portes: {}, rayonPorte: 30, controle: false,
        calques: { rues: ['M0 0H200V100H0Z'], ponts: [], obstacles: ['M95 0H105V80H95Z'], murs: [], eau: [] },
    });
    const reperes = [{ cle: 'a', nom: 'A', point: [20, 20] }, { cle: 'b', nom: 'B', point: [180, 20] }];
    const m = calculs.matrice({ reperes, variante: 'rues', marge: 6 });
    const r = calculs.itineraire({ etapes: reperes, variante: 'rues', marge: 6 });
    assert.equal(r.distance, m.matrice[0][1]);
    assert.equal(r.volDOiseau, m.volDOiseau[0][1]);
    const t = calculs.trajet({ depart: reperes[0], arrivee: reperes[1], variante: 'rues', marge: 6 });
    assert.equal(t.distance, m.matrice[0][1]);
});

test('Vahal : les distances du wiki', async () => {
    const ville = chargerVille('vahal');
    const c = ville.configuration;
    const calculs = new Calculs();
    await calculs.preparer({
        largeur: ville.largeur, hauteur: ville.hauteur, calques: ville.calques, interieur: c.interieur,
        portes: c.portes, rayonPorte: c.rayon_porte, controle: false,
    });
    const reperes = new Reperes(ville.lieux, c.portes);
    const repere = nom => reperes.geometrie(c.en_ville.find(r => r.nom === nom));
    const noms = ["Grand' Porte", "Grand' Place", 'Tour Blanche', 'Porte Nord', 'Porte Sud', 'Arènes'];
    const m = await calculs.matrice({ reperes: noms.map(repere), variante: 'ouvert', marge: c.marge_batiment });
    const d = (a, b) => m.matrice[noms.indexOf(a)][noms.indexOf(b)];
    // en unités du plan (0,5 m), à 2 % près
    proche(d("Grand' Porte", "Grand' Place"), 190, 4, "Grand' Porte → Grand' Place");
    proche(d("Grand' Place", 'Tour Blanche'), 548, 11, "Grand' Place → Tour Blanche (par le pont)");
    proche(d('Porte Nord', 'Porte Sud'), 1152, 23, 'Porte Nord → Porte Sud');
    proche(d('Porte Sud', 'Arènes'), 239, 5, 'Porte Sud → Arènes');
});
