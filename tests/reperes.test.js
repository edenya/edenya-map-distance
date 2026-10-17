import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Reperes } from '../src/donnees/reperes.js';
import { boite, centre } from '../src/geometrie.js';

const lieux = {
    lieux: [{ titre: 'La tour', cercle: [100, 100, 10] }],
    batiments: [{ secteur: 'GU', numero: 25, poly: [[0, 0], [10, 0], [10, 20], [0, 20]] }],
};
const reperes = new Reperes(lieux, { 'Porte Nord': [5, 6] });

test('un repère se place par un lieu, un bâtiment, une porte ou un point', () => {
    assert.deepEqual(reperes.geometrie({ nom: 'T', lieu: 'La tour' }).cercle, [100, 100, 10]);
    assert.deepEqual(reperes.geometrie({ nom: 'G', batiment: ['GU', 25] }).poly.length, 4);
    assert.deepEqual(reperes.geometrie({ nom: 'N', porte: 'Porte Nord' }).point, [5, 6]);
    assert.deepEqual(reperes.geometrie({ nom: 'P', point: ['7', '8'] }).point, [7, 8]);
});

test('un repère introuvable est refusé avec son nom', () => {
    assert.throws(() => reperes.geometrie({ nom: 'X', lieu: 'Ailleurs' }), /Ailleurs/);
    assert.throws(() => reperes.geometrie({ nom: 'X', batiment: ['GU', 1] }), /GU 1/);
    assert.throws(() => reperes.geometrie({ nom: 'X', porte: 'Porte Est' }), /Porte Est/);
    assert.throws(() => reperes.geometrie({ nom: 'Rien' }), /Rien/);
});

test("le centre et la boîte d'une forme", () => {
    const g = reperes.geometrie({ nom: 'G', batiment: ['GU', 25] });
    assert.deepEqual(centre(g), [5, 10]);
    assert.deepEqual(boite(g), [0, 0, 10, 20]);
    assert.deepEqual(boite({ cercle: [100, 100, 10] }), [90, 90, 110, 110]);
});
