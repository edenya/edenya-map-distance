// Fabrique d'éléments : creer('button', { class: 'x', onclick: f }, 'texte', autreElement).
// Un attribut à null ou false est omis ; on… pose un écouteur ; dataset accepte un objet.

const SVG = 'http://www.w3.org/2000/svg';

function remplir(el, attributs, enfants) {
    for (const [nom, valeur] of Object.entries(attributs ?? {})) {
        if (valeur === null || valeur === undefined || valeur === false) {
            continue;
        }
        if (nom.startsWith('on') && typeof valeur === 'function') {
            el.addEventListener(nom.slice(2), valeur);
        } else if (nom === 'dataset') {
            Object.assign(el.dataset, valeur);
        } else {
            el.setAttribute(nom, valeur === true ? '' : valeur);
        }
    }
    el.append(...enfants.flat().filter(e => e !== null && e !== undefined && e !== false));
    return el;
}

export function creer(balise, attributs, ...enfants) {
    return remplir(document.createElement(balise), attributs, enfants);
}

export function creerSvg(balise, attributs, ...enfants) {
    return remplir(document.createElementNS(SVG, balise), attributs, enfants);
}

// Les points d'une forme SVG : [[x, y]…] ou [x0, y0, x1, y1…]
export function points(liste) {
    if (liste.length && Array.isArray(liste[0])) {
        return liste.map(p => p.join(',')).join(' ');
    }
    const texte = [];
    for (let i = 0; i < liste.length; i += 2) {
        texte.push(`${liste[i]},${liste[i + 1]}`);
    }
    return texte.join(' ');
}

// La forme SVG d'une géométrie de repère (polygone ou cercle), null pour un point
export function formeSvg(geo, attributs = {}) {
    if (geo.cercle) {
        return creerSvg('circle', { cx: geo.cercle[0], cy: geo.cercle[1], r: geo.cercle[2], ...attributs });
    }
    if (geo.poly) {
        return creerSvg('polygon', { points: points(geo.poly), ...attributs });
    }
    return null;
}
