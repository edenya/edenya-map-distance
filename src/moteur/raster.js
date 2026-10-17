// Des formes vectorielles en masques de la grille (1 = rempli), dessinées dans un canevas hors
// écran à une unité du plan par pixel. Un pixel compte quand il est couvert à plus de moitié.

function canevas(largeur, hauteur) {
    const toile = new OffscreenCanvas(largeur, hauteur);
    return toile.getContext('2d', { willReadFrequently: true });
}

function seuil(g, largeur, hauteur) {
    const px = g.getImageData(0, 0, largeur, hauteur).data;
    const masque = new Uint8Array(largeur * hauteur);
    for (let i = 0; i < masque.length; i++) {
        masque[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    }
    return masque;
}

// Les chemins SVG (attribut d) d'un ou plusieurs calques du dessin, sur toute la grille
export function masqueDesChemins(grille, chemins) {
    const g = canevas(grille.largeur, grille.hauteur);
    for (const d of chemins) {
        g.fill(new Path2D(d), 'evenodd');
    }
    return seuil(g, grille.largeur, grille.hauteur);
}

// Une forme dans un cadre entier [x0, y0, largeur, hauteur] de la grille : le masque du cadre
export function masqueDuCadre(cadre, dessiner) {
    const [x0, y0, l, h] = cadre;
    const g = canevas(l, h);
    g.translate(-x0, -y0);
    dessiner(g);
    return seuil(g, l, h);
}
