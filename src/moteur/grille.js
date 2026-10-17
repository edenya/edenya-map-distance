// La grille du plan : une case par unité du plan, numérotée k = y × largeur + x.

export class Grille {
    constructor(largeur, hauteur) {
        this.largeur = largeur;
        this.hauteur = hauteur;
        this.taille = largeur * hauteur;
    }

    dedans(x, y) {
        return x >= 0 && y >= 0 && x < this.largeur && y < this.hauteur;
    }

    // La case praticable la plus proche d'un point, -1 s'il n'y en a pas à moins de 120 unités
    accroche(praticable, x, y) {
        const W = this.largeur;
        x = Math.round(x);
        y = Math.round(y);
        for (let r = 0; r < 120; r++) {
            let meilleure = -1;
            let d = Infinity;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.dedans(x + dx, y + dy)) {
                        continue;
                    }
                    const k = (y + dy) * W + x + dx;
                    if (praticable[k] && Math.hypot(dx, dy) < d) {
                        d = Math.hypot(dx, dy);
                        meilleure = k;
                    }
                }
            }
            if (meilleure >= 0) {
                return meilleure;
            }
        }
        return -1;
    }

    // Tout ce qui s'atteint depuis une case, de proche en proche (quatre voisines), dans un masque
    remplir(masque, depart, vu = new Uint8Array(this.taille)) {
        const W = this.largeur;
        const H = this.hauteur;
        if (depart < 0 || !masque[depart]) {
            return vu;
        }
        const pile = [depart];
        vu[depart] = 1;
        while (pile.length) {
            const k = pile.pop();
            const x = k % W;
            const y = (k - x) / W;
            if (x > 0 && masque[k - 1] && !vu[k - 1]) {
                vu[k - 1] = 1;
                pile.push(k - 1);
            }
            if (x < W - 1 && masque[k + 1] && !vu[k + 1]) {
                vu[k + 1] = 1;
                pile.push(k + 1);
            }
            if (y > 0 && masque[k - W] && !vu[k - W]) {
                vu[k - W] = 1;
                pile.push(k - W);
            }
            if (y < H - 1 && masque[k + W] && !vu[k + W]) {
                vu[k + W] = 1;
                pile.push(k + W);
            }
        }
        return vu;
    }
}

// Seize directions (pas de cavalier compris) : l'écart à la ligne droite reste sous 3 %.
// [dx, dy, longueur du pas]
export const PAS = (() => {
    const pas = [];
    for (const [a, b] of [[1, 0], [1, 1], [2, 1], [1, 2]]) {
        for (const sx of [1, -1]) {
            for (const sy of [1, -1]) {
                for (const [dx, dy] of [[a * sx, b * sy], [b * sx, a * sy]]) {
                    if (!pas.some(p => p[0] === dx && p[1] === dy)) {
                        pas.push([dx, dy, Math.hypot(dx, dy)]);
                    }
                }
            }
        }
    }
    return pas;
})();
