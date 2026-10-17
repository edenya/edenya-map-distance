import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Tas } from '../src/moteur/tas.js';

test('le tas rend les clés de la plus petite à la plus grande valeur', () => {
    const tas = new Tas(2);
    const valeurs = [5, 1, 4, 1.5, 9, 0, 3];
    valeurs.forEach((v, cle) => tas.ajouter(cle, v));
    const sortie = [];
    while (tas.n) {
        tas.retirer();
        sortie.push(tas.valeur);
    }
    assert.deepEqual(sortie, [...valeurs].sort((a, b) => a - b));
});

test('le tas grandit au-delà de sa capacité et garde clé et valeur ensemble', () => {
    const tas = new Tas(1);
    tas.ajouter(10, 2);
    tas.ajouter(20, 1);
    tas.retirer();
    assert.equal(tas.cle, 20);
    assert.equal(tas.valeur, 1);
});
