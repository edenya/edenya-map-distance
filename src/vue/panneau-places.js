// L'onglet Places : la taille de chaque place de la configuration, ce qui reste de l'espace
// libre quand on en retire tout passage plus étroit que deux fois son rayon. Chaque zone mesurée
// est peinte sur le plan.

import { creer, creerSvg } from './dom.js';
import { INSECABLE, texteAire, texteCotes, texteNombre } from './format.js';
import { ListeReperes } from './liste-reperes.js';

const COULEUR_ZONE = [214, 110, 20, 120];

// Le masque d'une zone en image (une URL de données), à poser sur sa boîte
function imageDeZone(masque, largeur, hauteur) {
    const toile = document.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    const g = toile.getContext('2d');
    const image = g.createImageData(largeur, hauteur);
    for (let i = 0; i < masque.length; i++) {
        if (masque[i]) {
            image.data.set(COULEUR_ZONE, i * 4);
        }
    }
    g.putImageData(image, 0, 0);
    return toile.toDataURL();
}

export class PanneauPlaces {
    constructor(section, contexte) {
        this.c = contexte;
        this.resultats = null;
        const $ = selecteur => section.querySelector(selecteur);
        this.bouton = $('[data-mesurer]');
        this.attente = $('[data-attente]');
        this.table = $('[data-places]');
        this.interieur = $('[data-interieur]');
        this.liste = new ListeReperes({ reglages: contexte.reglages, catalogue: contexte.catalogue, liste: 'dp-catalogue', places: true });
        this.liste.groupe = 'places';
        $('[data-liste]').append(this.liste.element);
        this.liste.addEventListener('change', () => this.oublier());
        this.liste.addEventListener('mode', () => this.c.plan.modeChoix(this.liste.ajoutParLePlan));
        this.bouton.addEventListener('click', () => this.mesurer());
        this.table.addEventListener('pointerover', e => this.survoler(e.target.closest('[data-zone]')));
        this.table.addEventListener('pointerleave', () => this.survoler(null));
        this.rendre();
    }

    activer() {
        this.c.plan.montrer('places', true);
        this.c.plan.modeChoix(this.liste.ajoutParLePlan);
    }

    desactiver() {
        this.c.plan.montrer('places', false);
        this.c.plan.modeChoix(false);
    }

    // Un clic ajoute une place à cet endroit, nommée d'après ce qu'on a cliqué
    choisir({ x, y, forme }) {
        if (this.liste.ajoutParLePlan) {
            this.liste.ajouter({ nom: forme?.lieu?.titre ?? forme?.batiment?.nom ?? 'Place', point: [Math.round(x), Math.round(y)] });
        }
    }

    oublier() {
        this.resultats = null;
        this.rendre();
    }

    terrainChange() {
        this.oublier();
    }

    rafraichir() {
        this.rendre();
    }

    async mesurer() {
        const { reglages } = this.c;
        this.bouton.disabled = true;
        this.attente.hidden = false;
        try {
            await this.c.pret;
            const places = this.liste.reperes.map(p => ({ nom: p.nom, point: p.point, rayon: p.rayon ?? reglages.rayonPlaces }));
            this.resultats = await this.c.moteur.places(places, this.c.statut.suivre('Places'));
            this.c.statut.effacer();
        } catch (e) {
            this.c.statut.erreur(e.message);
        }
        this.bouton.disabled = false;
        this.attente.hidden = true;
        this.rendre();
    }

    rendre() {
        const { reglages } = this.c;
        if (this.c.interieurLibre) {
            this.interieur.textContent = `Sol libre à l'intérieur des murs : ${texteAire(this.c.interieurLibre, reglages)}.`;
        }
        const r = this.resultats;
        this.table.hidden = !r;
        if (r) {
            const m = u => `${texteNombre(Math.round(u * reglages.echelle))}${INSECABLE}m`;
            this.table.replaceChildren(
                creer('thead', {}, creer('tr', {}, [['Place'], ['Aire'], ['≈ Rectangle', 'Le rectangle qui lui ressemble le plus (mêmes moments)'], ['Boîte'], ['Rayon']]
                    .map(([t, titre]) => creer('th', { scope: 'col', title: titre }, t)))),
                creer('tbody', {}, r.map((p, i) => (p.aire
                    ? creer('tr', { 'data-zone': i },
                        creer('th', { scope: 'row' }, p.nom),
                        creer('td', {}, texteAire(p.aire, reglages)),
                        creer('td', {}, texteCotes(p.rectangle[0], p.rectangle[1], reglages)),
                        creer('td', {}, texteCotes(p.boite[2], p.boite[3], reglages)),
                        creer('td', {}, m(p.rayon)))
                    : creer('tr', {}, creer('th', { scope: 'row' }, p.nom), creer('td', { colspan: 4, class: 'message--erreur' }, "Introuvable : le point n'est pas dans un espace assez large."))))));
        }
        this.dessiner();
    }

    dessiner() {
        const { plan } = this.c;
        const r = this.resultats ?? [];
        plan.dessiner('places', r.map((p, i) => {
            if (!p.aire) {
                return null;
            }
            const [x, y, l, h] = p.boite;
            return creerSvg('image', { class: 'zone', 'data-zone': i, x, y, width: l, height: h, href: imageDeZone(p.masque, l, h), preserveAspectRatio: 'none' });
        }));
        plan.etiqueter('places', this.liste.reperes.filter(p => p.point).map(p => ({ x: p.point[0], y: p.point[1], texte: p.nom, classe: 'etiquette--repere', titre: p.nom })));
    }

    survoler(el) {
        const g = this.c.plan.couche('places').g;
        g.querySelectorAll('.zone--survol').forEach(z => z.classList.remove('zone--survol'));
        if (el) {
            g.querySelector(`[data-zone="${el.dataset.zone}"]`)?.classList.add('zone--survol');
        }
    }
}
