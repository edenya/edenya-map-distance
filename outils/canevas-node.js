// Ce que le navigateur donne au moteur et que Node n'a pas : OffscreenCanvas, Path2D, ImageData,
// fournis par @napi-rs/canvas (Skia, comme Chrome). À importer avant le moteur.

import { createCanvas, ImageData, Path2D } from '@napi-rs/canvas';

if (typeof globalThis.OffscreenCanvas === 'undefined') {
    globalThis.OffscreenCanvas = class OffscreenCanvas {
        constructor(largeur, hauteur) {
            const toile = createCanvas(largeur, hauteur);
            // l'API des toiles de Chrome hors écran, celle dont le moteur se sert
            toile.convertToBlob = async ({ type = 'image/png' } = {}) => new Blob([await toile.encode(type.split('/')[1])], { type });
            return toile;
        }
    };
}
globalThis.Path2D ??= Path2D;
globalThis.ImageData ??= ImageData;
