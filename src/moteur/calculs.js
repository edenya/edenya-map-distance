// Les calculs du moteur. La page les fait tourner dans un Web Worker (worker.js), pour ne pas se
// figer ; l'outil en ligne de commande (outils/mesurer.js) les appelle directement. Les distances
// rendues sont en unités du plan, arrondies au dixième ; progresser(fait, total, texte) suit les
// longs calculs.

import { Chercheur, volDOiseau } from './chemins.js';
import { cellulesDeDepart } from './departs.js';
import { Grille } from './grille.js';
import { ouverture, zone } from './places.js';
import { CLASSES, Terrain } from './terrain.js';

const dixieme = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const sansSuivi = () => {};

export class Calculs {
    constructor() {
        this.grille = null;
        this.terrain = null;
        this.chercheur = null;
        this.palette = {};
        this.departs = new Map();
        this.ouvertures = new Map();
    }

    pret() {
        if (!this.terrain?.praticables) {
            throw new Error("Le terrain n'est pas prêt.");
        }
    }

    // Les cases de départ d'un repère, gardées tant que le terrain et la marge ne changent pas
    casesDe(geo, variante, marge) {
        const cle = `${variante}|${marge}|${geo.cle}|${geo.centre ? 1 : 0}`;
        if (!this.departs.has(cle)) {
            this.departs.set(cle, cellulesDeDepart(this.grille, this.terrain.praticable(variante), geo, marge));
        }
        return this.departs.get(cle);
    }

    // Une couleur [r, g, b, a] par classe de case (CLASSES), en image de la grille
    imageDesClasses(palette = this.palette) {
        const classes = this.terrain.classes();
        const couleurs = Object.entries(CLASSES).map(([nom, c]) => [c, palette[nom] ?? [0, 0, 0, 0]]);
        const image = new ImageData(this.grille.largeur, this.grille.hauteur);
        for (let i = 0; i < classes.length; i++) {
            image.data.set(couleurs[classes[i]][1], i * 4);
        }
        return image;
    }

    // Le calque de contrôle, en image PNG
    async imageDeControle() {
        const toile = new OffscreenCanvas(this.grille.largeur, this.grille.hauteur);
        toile.getContext('2d').putImageData(this.imageDesClasses(), 0, 0);
        return toile.convertToBlob({ type: 'image/png' });
    }

    // { largeur, hauteur, calques, interieur, portes, rayonPorte, palette, controle } ; controle: false
    // se passe de l'image de contrôle
    async preparer(m, progresser = sansSuivi) {
        this.grille = new Grille(m.largeur, m.hauteur);
        this.palette = m.palette ?? {};
        progresser(0, 3, 'Dessin des calques');
        this.terrain = new Terrain(this.grille, m.calques);
        progresser(1, 3, "L'intérieur des murs");
        this.terrain.definirInterieur(m.interieur);
        progresser(2, 3, 'Les portes');
        this.terrain.ouvrirPortes(m.portes, m.rayonPorte);
        this.chercheur = new Chercheur(this.grille);
        this.departs.clear();
        this.ouvertures.clear();
        return { interieurLibre: this.terrain.interieurLibre, controle: m.controle === false ? null : await this.imageDeControle() };
    }

    // { portes, rayonPorte } : rouvre les portes (les intérieurs ne changent pas)
    async portes(m) {
        this.terrain.ouvrirPortes(m.portes, m.rayonPorte);
        this.departs.clear();
        return { controle: await this.imageDeControle() };
    }

    // { depart, arrivee, variante, marge } : le plus court chemin entre deux repères
    trajet(m) {
        this.pret();
        const praticable = this.terrain.praticable(m.variante);
        const a = this.casesDe(m.depart, m.variante, m.marge);
        const b = this.casesDe(m.arrivee, m.variante, m.marge);
        const resultat = { departs: a.length, arrivees: b.length, distance: null, volDOiseau: null, chemin: null };
        if (!a.length || !b.length) {
            return resultat;
        }
        resultat.volDOiseau = dixieme(volDOiseau(this.grille, a, b));
        const fin = this.chercheur.aEtoile(praticable, a, b);
        if (fin >= 0) {
            resultat.distance = dixieme(this.chercheur.dist[fin]);
            resultat.chemin = this.chercheur.trace(fin);
        }
        return resultat;
    }

    // { reperes, variante, marge } : les distances entre tous les repères, et leurs chemins
    matrice(m, progresser = sansSuivi) {
        this.pret();
        const praticable = this.terrain.praticable(m.variante);
        const n = m.reperes.length;
        const cases = m.reperes.map(r => this.casesDe(r, m.variante, m.marge));
        const matrice = cases.map(() => cases.map(() => null));
        const vol = cases.map(() => cases.map(() => null));
        const chemins = cases.map(() => cases.map(() => null));
        for (let a = 0; a < n; a++) {
            progresser(a, n, m.reperes[a].nom);
            if (!cases[a].length) {
                continue;
            }
            const dist = this.chercheur.dijkstra(praticable, cases[a], cases);
            for (let b = 0; b < n; b++) {
                let min = Infinity;
                let fin = -1;
                for (const k of cases[b]) {
                    if (dist[k] < min) {
                        min = dist[k];
                        fin = k;
                    }
                }
                matrice[a][b] = dixieme(min);
                if (b !== a && fin >= 0) {
                    chemins[a][b] = this.chercheur.trace(fin);
                }
                if (cases[b].length) {
                    vol[a][b] = dixieme(volDOiseau(this.grille, cases[a], cases[b]));
                }
            }
        }
        return { departs: cases.map(c => c.length), matrice, volDOiseau: vol, chemins };
    }

    // { places: [{ nom, point, rayon }] } : la taille de chaque place
    places(m, progresser = sansSuivi) {
        this.pret();
        return m.places.map((p, i) => {
            progresser(i, m.places.length, p.nom);
            if (!this.ouvertures.has(p.rayon)) {
                this.ouvertures.set(p.rayon, ouverture(this.grille, this.terrain.libre, p.rayon));
            }
            const o = this.ouvertures.get(p.rayon);
            return { nom: p.nom, rayon: p.rayon, ...zone(this.grille, o, this.grille.accroche(o, p.point[0], p.point[1])) };
        });
    }
}
