// Le terrain d'une ville en masques de la grille : ce qui se parcourt, l'intérieur des murs, les
// portes, et les trois façons d'y marcher (VARIANTES).

import { masqueDesChemins } from './raster.js';

export const VARIANTES = ['rues', 'ouvert', 'partout'];

// Classes du calque de contrôle, de la moins à la plus praticable
export const CLASSES = { infranchissable: 0, dehors: 1, interieur: 2, rue: 3 };

export class Terrain {
    // calques : par rôle (rues, ponts, obstacles, murs, eau), les chemins SVG du dessin
    constructor(grille, calques) {
        this.grille = grille;
        const masque = role => masqueDesChemins(grille, calques[role] ?? []);
        this.rues = masque('rues');
        this.ponts = masque('ponts');
        this.obstacles = masque('obstacles');
        this.murs = masque('murs');
        this.eau = masque('eau');
        // La terre ferme libre : hors de l'eau (sauf sur un pont ou une rue), des maisons et des murs
        this.sol = this.variante(i => (!this.eau[i] || this.ponts[i] || this.rues[i]) && !this.obstacles[i] && !this.murs[i]);
        this.interieur = new Uint8Array(grille.taille);
        this.interieurLibre = 0;
        this.portes = new Uint8Array(grille.taille);
        this.praticables = null;
        this.libreCache = null;
    }

    variante(f) {
        const m = new Uint8Array(this.grille.taille);
        for (let i = 0; i < m.length; i++) {
            m[i] = f(i) ? 1 : 0;
        }
        return m;
    }

    // L'intérieur des murs : ce qui s'atteint d'un point sans franchir un mur, l'eau ou une maison
    // (les portes ne sont pas encore ouvertes)
    definirInterieur(point) {
        this.interieur = new Uint8Array(this.grille.taille);
        if (point) {
            this.grille.remplir(this.sol, this.grille.accroche(this.sol, point[0], point[1]), this.interieur);
        }
        this.interieurLibre = this.interieur.reduce((n, v) => n + v, 0);
    }

    // Chaque porte, un disque de rayon unités ouvert dans la muraille ; puis les trois praticables
    ouvrirPortes(portes, rayon) {
        const g = this.grille;
        this.portes = new Uint8Array(g.taille);
        for (const [x, y] of Object.values(portes ?? {})) {
            for (let dy = -rayon; dy <= rayon; dy++) {
                for (let dx = -rayon; dx <= rayon; dx++) {
                    if (dx * dx + dy * dy <= rayon * rayon && g.dedans(x + dx, y + dy)) {
                        this.portes[(y + dy) * g.largeur + x + dx] = 1;
                    }
                }
            }
        }
        const { rues, obstacles, interieur, portes: ouvertes, murs, eau, ponts } = this;
        this.praticables = {
            // par les rues, les places et les ponts, à l'intérieur des murs
            rues: this.variante(i => (rues[i] && !obstacles[i] && interieur[i]) || (ouvertes[i] && !obstacles[i])),
            // tout l'espace libre des murs : parcs et jardins ouverts compris
            ouvert: this.variante(i => interieur[i] || (ouvertes[i] && !obstacles[i])),
            // dedans et dehors, à travers champs, les murs seulement aux portes
            partout: this.variante(i => (!eau[i] || ponts[i] || rues[i]) && !obstacles[i] && (!murs[i] || ouvertes[i])),
        };
    }

    praticable(variante) {
        const p = this.praticables?.[variante];
        if (!p) {
            throw new Error(`Variante inconnue : ${variante}`);
        }
        return p;
    }

    // L'espace où se mesurent les places : les rues et les ponts, hors des maisons et des murs
    get libre() {
        this.libreCache ??= this.variante(i => (this.rues[i] || this.ponts[i]) && !this.obstacles[i] && !this.murs[i]);
        return this.libreCache;
    }

    // Une classe (CLASSES) par case, pour le calque de contrôle
    classes() {
        const { rues, partout } = this.praticables;
        const c = new Uint8Array(this.grille.taille);
        for (let i = 0; i < c.length; i++) {
            c[i] = rues[i] ? CLASSES.rue : this.interieur[i] ? CLASSES.interieur : partout[i] ? CLASSES.dehors : CLASSES.infranchissable;
        }
        return c;
    }
}
