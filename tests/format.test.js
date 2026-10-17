import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tableauWiki } from '../src/vue/exports.js';
import { metres, texteDuree, texteMetres } from '../src/vue/format.js';

const reglages = { echelle: 0.5, arrondi: 10 };
const I = ' ';

test('les mètres : à 5 m sous 100 m, à 10 m au-delà, jamais moins de 5 m', () => {
    assert.equal(metres(190, reglages), 95);
    assert.equal(metres(548, reglages), 270);
    assert.equal(metres(4, reglages), 5);
    assert.equal(metres(null, reglages), null);
});

test('les mètres et les minutes ne se coupent pas en fin de ligne', () => {
    assert.equal(texteMetres(190, reglages), `95${I}m`);
    assert.equal(texteDuree(190, 4.5, reglages), `1${I}min`);
    assert.equal(texteDuree(60, 4.5, reglages), `<${I}1${I}min`);
    assert.equal(texteDuree(null, 4.5, reglages), '-');
});

test('un tableau DokuWiki : en-têtes, puis cellules alignées à droite', () => {
    assert.equal(
        tableauWiki(['Trajet', 'Par les rues'], [['A → B', `95${I}m`]]),
        `^ Trajet ^ Par les rues ^\n| A → B |  95${I}m |`,
    );
});
