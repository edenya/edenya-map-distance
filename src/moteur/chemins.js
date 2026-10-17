// Les plus courts chemins sur la grille, en seize directions (PAS), sans jamais couper le coin
// d'une case infranchissable. Les tampons (distances, prédécesseurs, tas) servent d'un calcul à
// l'autre : on lit un résultat avant de lancer le suivant.

import { PAS } from './grille.js';
import { Tas } from './tas.js';

export class Chercheur {
    constructor(grille) {
        this.grille = grille;
        this.dist = new Float64Array(grille.taille);
        this.prec = new Int32Array(grille.taille);
        this.marque = new Uint8Array(grille.taille);
        this.tas = new Tas();
    }

    initialiser() {
        this.dist.fill(Infinity);
        this.prec.fill(-1);
        this.tas.vider();
    }

    // Les voisines praticables de k, atteintes à v + pas ; h donne la priorité (A*) en plus de la distance
    relacher(praticable, k, v, h) {
        const { largeur: W, hauteur: H } = this.grille;
        const { dist, prec, tas } = this;
        const x = k % W;
        const y = (k - x) / W;
        for (const [dx, dy, pas] of PAS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
                continue;
            }
            const nk = ny * W + nx;
            if (!praticable[nk]) {
                continue;
            }
            const ax = Math.abs(dx);
            const ay = Math.abs(dy);
            if (ax + ay > 1) {
                // jamais de coin coupé : on passe par une case voisine praticable
                const cote = praticable[y * W + x + Math.sign(dx)];
                const dessous = praticable[(y + Math.sign(dy)) * W + x];
                if ((!cote && !dessous) || (ax === 2 && !cote) || (ay === 2 && !dessous)) {
                    continue;
                }
            }
            const nv = v + pas;
            if (nv < dist[nk]) {
                dist[nk] = nv;
                prec[nk] = k;
                tas.ajouter(nk, h ? nv + h(nk) : nv);
            }
        }
    }

    // Dijkstra depuis des cases de départ. Avec des cibles (des listes de cases), s'arrête quand
    // chacune a une case atteinte : la plus petite distance de ses cases est alors définitive.
    // Renvoie this.dist ; this.prec garde les chemins.
    dijkstra(praticable, departs, cibles = null) {
        const { dist, tas, marque } = this;
        this.initialiser();
        for (const s of departs) {
            dist[s] = 0;
            tas.ajouter(s, 0);
        }
        const appartenance = new Map();
        const atteinte = new Uint8Array(cibles?.length ?? 0);
        let restantes = 0;
        cibles?.forEach((cases, j) => {
            if (!cases.length) {
                return;
            }
            restantes++;
            for (const k of cases) {
                marque[k] = 1;
                if (!appartenance.has(k)) {
                    appartenance.set(k, []);
                }
                appartenance.get(k).push(j);
            }
        });
        while (tas.n && (!cibles || restantes)) {
            tas.retirer();
            const k = tas.cle;
            const v = tas.valeur;
            if (v > dist[k]) {
                continue;
            }
            if (marque[k]) {
                for (const j of appartenance.get(k)) {
                    if (!atteinte[j]) {
                        atteinte[j] = 1;
                        restantes--;
                    }
                }
            }
            this.relacher(praticable, k, v, null);
        }
        for (const k of appartenance.keys()) {
            marque[k] = 0;
        }
        return dist;
    }

    // A* des départs vers la plus proche des arrivées ; l'heuristique, la distance au cadre des
    // arrivées, ne surestime jamais : le chemin trouvé est le plus court. Renvoie la case
    // d'arrivée atteinte (sa distance est this.dist[fin]), -1 s'il n'y a pas de chemin.
    aEtoile(praticable, departs, arrivees) {
        const W = this.grille.largeur;
        const { dist, tas, marque } = this;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const k of arrivees) {
            const x = k % W;
            const y = (k - x) / W;
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
            marque[k] = 1;
        }
        const h = k => {
            const x = k % W;
            const y = (k - x) / W;
            return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
        };
        this.initialiser();
        for (const s of departs) {
            dist[s] = 0;
            tas.ajouter(s, h(s));
        }
        let fin = -1;
        while (tas.n) {
            tas.retirer();
            const k = tas.cle;
            if (tas.valeur > dist[k] + h(k) + 1e-9) {
                continue;
            }
            if (marque[k]) {
                fin = k;
                break;
            }
            this.relacher(praticable, k, dist[k], h);
        }
        for (const k of arrivees) {
            marque[k] = 0;
        }
        return fin;
    }

    // Le chemin qui mène à une case, en points du plan (le milieu de chaque case), simplifié
    trace(fin) {
        const W = this.grille.largeur;
        const points = [];
        for (let k = fin; k >= 0; k = this.prec[k]) {
            const x = k % W;
            points.push(x + 0.5, (k - x) / W + 0.5);
        }
        return simplifier(points, 0.6);
    }
}

// La plus petite distance entre deux ensembles de cases, à vol d'oiseau
export function volDOiseau(grille, a, b) {
    const W = grille.largeur;
    let min = Infinity;
    for (const i of a) {
        const xi = i % W;
        const yi = (i - xi) / W;
        for (const j of b) {
            const xj = j % W;
            const dx = xi - xj;
            const dy = yi - (j - xj) / W;
            const q = dx * dx + dy * dy;
            if (q < min) {
                min = q;
            }
        }
    }
    return Math.sqrt(min);
}

// Douglas-Peucker : garde les points qui s'écartent de plus de tolerance de la ligne simplifiée.
// points et résultat : [x0, y0, x1, y1…]
export function simplifier(points, tolerance) {
    const n = points.length / 2;
    if (n < 3) {
        return Float32Array.from(points);
    }
    const garde = new Uint8Array(n);
    garde[0] = garde[n - 1] = 1;
    const pile = [[0, n - 1]];
    while (pile.length) {
        const [a, b] = pile.pop();
        const ax = points[a * 2];
        const ay = points[a * 2 + 1];
        const dx = points[b * 2] - ax;
        const dy = points[b * 2 + 1] - ay;
        const longueur = Math.hypot(dx, dy) || 1;
        let pire = -1;
        let ecart = tolerance;
        for (let i = a + 1; i < b; i++) {
            const e = Math.abs(dy * (points[i * 2] - ax) - dx * (points[i * 2 + 1] - ay)) / longueur;
            if (e > ecart) {
                ecart = e;
                pire = i;
            }
        }
        if (pire >= 0) {
            garde[pire] = 1;
            pile.push([a, pire], [pire, b]);
        }
    }
    const resultat = [];
    for (let i = 0; i < n; i++) {
        if (garde[i]) {
            resultat.push(points[i * 2], points[i * 2 + 1]);
        }
    }
    return Float32Array.from(resultat);
}
