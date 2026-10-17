// Les distances en mots : des unités du plan en mètres, en minutes, en aires. Les règles
// d'arrondi sont celles de la page « distances » du wiki.

export const INSECABLE = ' ';

const nombres = new Map();
export function texteNombre(n, decimales = 0) {
    if (!nombres.has(decimales)) {
        nombres.set(decimales, new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }));
    }
    return nombres.get(decimales).format(n);
}

// En mètres arrondis : à 5 m sous 100 m, à « arrondi » mètres au-delà, jamais moins de 5 m
export function metres(u, reglages) {
    if (u === null || u === undefined) {
        return null;
    }
    const m = u * reglages.echelle;
    const pas = m < 100 ? 5 : reglages.arrondi;
    return Math.max(5, Math.round(m / pas) * pas);
}

export function texteMetres(u, reglages) {
    const m = metres(u, reglages);
    return m === null ? '-' : `${m}${INSECABLE}m`;
}

export function minutes(u, kmh, reglages) {
    return (u * reglages.echelle) / ((kmh * 1000) / 60);
}

// À la minute, « < 1 min » en dessous
export function texteDuree(u, kmh, reglages) {
    if (u === null || u === undefined) {
        return '-';
    }
    const t = minutes(u, kmh, reglages);
    return t < 1 ? `<${INSECABLE}1${INSECABLE}min` : `${Math.round(t)}${INSECABLE}min`;
}

// Une aire en unités carrées, en m² (et en hectares au-delà d'un)
export function texteAire(u2, reglages) {
    const m2 = u2 * reglages.echelle ** 2;
    const texte = `${texteNombre(Math.round(m2))}${INSECABLE}m²`;
    return m2 >= 10000 ? `${texte} (${texteNombre(m2 / 10000, 1)}${INSECABLE}ha)` : texte;
}

// Deux longueurs en unités, « 68 × 40 m »
export function texteCotes(a, b, reglages) {
    return `${texteNombre(Math.round(a * reglages.echelle))}${INSECABLE}×${INSECABLE}${texteNombre(Math.round(b * reglages.echelle))}${INSECABLE}m`;
}

// La longueur brute, pour vérifier : « 981,4 unités (490,7 m) »
export function texteBrut(u, reglages) {
    return `${texteNombre(u, 1)} unités (${texteNombre(u * reglages.echelle, 1)}${INSECABLE}m)`;
}
