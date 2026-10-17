// Les cases d'où part (ou où arrive) un repère. Un repère est une géométrie du plan :
// { point: [x, y] } | { poly: [[x, y]…] } | { cercle: [cx, cy, r] }, plus centre (booléen).

import { boite, centre } from '../geometrie.js';
import { masqueDuCadre } from './raster.js';

// Un point (ou un repère visé au centre) part de la case praticable la plus proche ; un bâtiment
// de toute case praticable de son pourtour, à marge unités près : sa porte peut être partout.
export function cellulesDeDepart(grille, praticable, geo, marge) {
    if (geo.centre || geo.point) {
        const [x, y] = centre(geo);
        const k = grille.accroche(praticable, x, y);
        return k >= 0 ? [k] : [];
    }
    const [bx0, by0, bx1, by1] = boite(geo);
    const x0 = Math.max(0, Math.floor(bx0 - marge - 2));
    const y0 = Math.max(0, Math.floor(by0 - marge - 2));
    const x1 = Math.min(grille.largeur, Math.ceil(bx1 + marge + 2));
    const y1 = Math.min(grille.hauteur, Math.ceil(by1 + marge + 2));
    if (x1 <= x0 || y1 <= y0) {
        return [];
    }
    const l = x1 - x0;
    const masque = masqueDuCadre([x0, y0, l, y1 - y0], g => {
        g.beginPath();
        if (geo.cercle) {
            g.arc(geo.cercle[0], geo.cercle[1], geo.cercle[2] + marge, 0, 2 * Math.PI);
            g.fill();
            return;
        }
        geo.poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
        g.lineWidth = marge * 2;
        g.lineJoin = 'round';
        g.stroke();
    });
    const cases = [];
    for (let i = 0; i < masque.length; i++) {
        if (!masque[i]) {
            continue;
        }
        const k = (y0 + Math.floor(i / l)) * grille.largeur + x0 + (i % l);
        if (praticable[k]) {
            cases.push(k);
        }
    }
    return cases;
}
