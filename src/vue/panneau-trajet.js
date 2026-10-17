// L'onglet Trajet : un départ, une arrivée (choisis dans la liste ou d'un clic sur le plan), le
// plus court chemin entre les deux, sa longueur, son détour et sa durée à chaque allure.

import { libelleDe } from '../donnees/reperes.js';
import { centre } from '../geometrie.js';
import { ChampRepere } from './champ-repere.js';
import { creer } from './dom.js';
import { boutonCopier, tableauWiki } from './exports.js';
import { INSECABLE, texteBrut, texteDuree, texteMetres, texteNombre } from './format.js';
import { boiteDuChemin, contour, remplirVariantes, trace, VARIANTES } from './traces.js';

export class PanneauTrajet {
    constructor(section, contexte) {
        this.c = contexte;
        this.section = section;
        this.resultat = null;
        this.numero = 0;
        const options = { catalogue: contexte.catalogue, liste: 'dp-catalogue' };
        this.depart = new ChampRepere({ ...options, libelle: 'Départ', pastille: 'A', classe: 'extremite--depart' });
        this.arrivee = new ChampRepere({ ...options, libelle: 'Arrivée', pastille: 'B', classe: 'extremite--arrivee' });
        const inverser = section.querySelector('[data-inverser]');
        inverser.before(this.depart.element);
        inverser.after(this.arrivee.element);
        this.variante = section.querySelector('[data-variante]');
        remplirVariantes(this.variante, 'partout');
        this.sortie = section.querySelector('[data-resultat]');

        for (const champ of [this.depart, this.arrivee]) {
            champ.addEventListener('activer', () => this.activerChamp(champ));
            champ.addEventListener('change', () => this.calculer());
        }
        inverser.addEventListener('click', () => {
            const a = this.depart.repere;
            const b = this.arrivee.repere;
            this.arrivee.definir(a);
            this.depart.definir(b);
        });
        this.variante.addEventListener('change', () => this.calculer());
        this.activerChamp(this.depart);
        this.rendre();
    }

    activerChamp(champ) {
        this.champActif = champ;
        this.depart.actif = champ === this.depart;
        this.arrivee.actif = champ === this.arrivee;
    }

    activer() {
        this.c.plan.montrer('trajet', true);
        this.c.plan.modeChoix(true);
    }

    desactiver() {
        this.c.plan.montrer('trajet', false);
        this.c.plan.modeChoix(false);
    }

    // Un clic sur le plan remplit le champ actif ; après le départ vient l'arrivée
    choisir(clic) {
        const champ = this.champActif;
        if (champ === this.depart) {
            this.activerChamp(this.arrivee);
        }
        champ.definir(this.c.catalogue.depuisPlan(clic, this.c.reglages.rayonPorte));
    }

    // Le terrain ou la marge ont changé
    terrainChange() {
        this.calculer();
    }

    // L'échelle, l'arrondi ou les allures ont changé
    rafraichir() {
        this.rendre();
    }

    geometrie(champ) {
        return champ.repere ? this.c.reperes.geometrie(champ.repere) : null;
    }

    async calculer() {
        const numero = ++this.numero;
        this.resultat = null;
        this.erreur = null;
        try {
            this.geos = [this.geometrie(this.depart), this.geometrie(this.arrivee)];
        } catch (e) {
            this.geos = [null, null];
            this.erreur = e.message;
        }
        this.calcul = Boolean(this.geos[0] && this.geos[1]);
        this.rendre();
        if (!this.calcul) {
            return;
        }
        try {
            await this.c.pret;
            const r = await this.c.moteur.trajet(this.geos[0], this.geos[1], this.variante.value, this.c.reglages.marge);
            if (numero !== this.numero) {
                return;
            }
            this.resultat = r;
        } catch (e) {
            if (numero !== this.numero) {
                return;
            }
            this.erreur = e.message;
        }
        this.calcul = false;
        this.rendre();
        if (this.resultat?.chemin) {
            this.c.plan.montrerBoite(boiteDuChemin(this.resultat.chemin), 64);
        }
    }

    rendre() {
        this.dessiner();
        const r = this.resultat;
        const { reglages } = this.c;
        if (this.erreur) {
            this.sortie.replaceChildren(creer('p', { class: 'message message--erreur' }, this.erreur));
            return;
        }
        if (this.calcul) {
            this.sortie.replaceChildren(creer('p', { class: 'message' }, 'Calcul du chemin…'));
            return;
        }
        if (!r) {
            this.sortie.replaceChildren(creer('p', { class: 'message' }, 'Choisissez un départ et une arrivée.'));
            return;
        }
        const conseil = this.variante.value === 'partout' ? '' : ' Hors les murs, choisissez « Partout, à travers champs ».';
        if (!r.departs || !r.arrivees) {
            const qui = !r.departs ? 'Le départ' : "L'arrivée";
            this.sortie.replaceChildren(creer('p', { class: 'message message--erreur' }, `${qui} n'a aucun accès praticable dans cette variante.${conseil}`));
            return;
        }
        if (r.distance === null) {
            this.sortie.replaceChildren(creer('p', { class: 'message message--erreur' }, `Aucun chemin entre ces deux repères dans cette variante.${conseil}`));
            return;
        }
        const allures = Object.entries(reglages.vitesses);
        this.sortie.replaceChildren(
            creer('p', { class: 'mesure' }, creer('strong', {}, texteMetres(r.distance, reglages)), ' ', creer('span', {}, VARIANTES[this.variante.value].libelle.toLowerCase())),
            creer('dl', { class: 'details' },
                creer('div', {}, creer('dt', {}, "À vol d'oiseau"), creer('dd', {}, `${texteMetres(r.volDOiseau, reglages)}, détour ×${INSECABLE}${texteNombre(r.distance / Math.max(1, r.volDOiseau), 2)}`)),
                allures.map(([allure, kmh]) => creer('div', {}, creer('dt', {}, `${allure} (${texteNombre(kmh, 1)} km/h)`), creer('dd', {}, texteDuree(r.distance, kmh, reglages)))),
                creer('div', {}, creer('dt', {}, 'Longueur exacte'), creer('dd', {}, texteBrut(r.distance, reglages)))),
            creer('div', { class: 'rangee' },
                creer('button', { type: 'button', class: 'bouton', onclick: () => this.c.plan.cadrer(boiteDuChemin(r.chemin), 64) }, 'Voir tout le trajet'),
                creer('button', { type: 'button', class: 'bouton', onclick: e => boutonCopier(e.currentTarget, () => this.ligneWiki()) }, 'Copier pour le wiki')));
    }

    // La ligne du tableau des trajets du wiki, avec son en-tête
    ligneWiki() {
        const { reglages } = this.c;
        const r = this.resultat;
        const allures = Object.entries(reglages.vitesses);
        const colonne = this.variante.value === 'partout' ? 'Par les chemins' : 'Par les rues';
        return tableauWiki(['Trajet', "Vol d'oiseau", colonne, ...allures.map(([a]) => a)], [[
            `${libelleDe(this.depart.repere)} → ${libelleDe(this.arrivee.repere)}`,
            texteMetres(r.volDOiseau, reglages),
            texteMetres(r.distance, reglages),
            ...allures.map(([, kmh]) => texteDuree(r.distance, kmh, reglages)),
        ]]);
    }

    dessiner() {
        const { plan } = this.c;
        const [a, b] = this.geos ?? [null, null];
        const chemin = this.resultat?.chemin;
        plan.dessiner('trajet',
            a && contour(a, 'contour--depart'),
            b && contour(b, 'contour--arrivee'),
            chemin && trace(chemin, 'trace--trajet'));
        // le chemin part de l'arrivée : B à son début, A à sa fin
        const n = chemin?.length ?? 0;
        const posA = n ? [chemin[n - 2], chemin[n - 1]] : a && centre(a);
        const posB = n ? [chemin[0], chemin[1]] : b && centre(b);
        plan.etiqueter('trajet', [
            posA && { x: posA[0], y: posA[1], texte: 'A', classe: 'etiquette--depart', titre: a.nom },
            posB && { x: posB[0], y: posB[1], texte: 'B', classe: 'etiquette--arrivee', titre: b.nom },
        ].filter(Boolean));
    }
}
