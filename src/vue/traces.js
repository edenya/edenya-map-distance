// Ce que les onglets dessinent sur le plan : les variantes de chemin, les chemins, le contour
// des repères et leurs étiquettes.

import { centre } from '../geometrie.js';
import { creer, creerSvg, formeSvg, points } from './dom.js';

// Les trois façons de marcher du moteur (moteur/terrain.js, VARIANTES)
export const VARIANTES = {
    rues: { libelle: 'Par les rues, les places et les ponts', aide: "Dans les murs seulement ; on n'en sort que par les portes." },
    ouvert: { libelle: 'Dans les murs, parcs et jardins compris', aide: "Tout l'espace libre des murs, les parcs et les jardins ouverts compris." },
    partout: { libelle: 'Partout, à travers champs', aide: "Dedans et dehors ; la muraille ne se franchit qu'aux portes." },
};

export function remplirVariantes(select, choisie) {
    select.replaceChildren(...Object.entries(VARIANTES).map(([cle, v]) => creer('option', { value: cle, title: v.aide, selected: cle === choisie }, v.libelle)));
}

// Un chemin ([x0, y0…]) : un liseré clair sous un trait de couleur
export function trace(chemin, classe = '') {
    const p = points(chemin);
    return creerSvg('g', { class: `trace ${classe}` },
        creerSvg('polyline', { class: 'trace__halo', points: p }),
        creerSvg('polyline', { class: 'trace__trait', points: p }));
}

export function boiteDuChemin(chemin) {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < chemin.length; i += 2) {
        b = [Math.min(b[0], chemin[i]), Math.min(b[1], chemin[i + 1]), Math.max(b[2], chemin[i]), Math.max(b[3], chemin[i + 1])];
    }
    return b;
}

// Le contour d'un repère qui a une forme ; un point n'en a pas
export function contour(geo, classe = '') {
    return formeSvg(geo, { class: `contour ${classe}` });
}

// L'étiquette d'un repère, à son centre
export function etiquette(geo, texte, classe = '') {
    const [x, y] = centre(geo);
    return { x, y, texte, classe, titre: geo.nom };
}
