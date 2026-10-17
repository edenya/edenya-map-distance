// L'onglet Trajet : un itinéraire de deux étapes ou plus (A → B → C…), choisies dans la liste ou
// d'un clic sur le plan ; le plus court chemin qui les relie dans l'ordre, sa longueur, son
// détour, sa durée à chaque allure, et le détail de chaque tronçon.

import { libelleDe } from '../donnees/reperes.js';
import { centre, reunion } from '../geometrie.js';
import { ChampRepere } from './champ-repere.js';
import { creer } from './dom.js';
import { boutonCopier, tableauWiki } from './exports.js';
import { INSECABLE, texteBrut, texteDuree, texteMetres, texteNombre } from './format.js';
import { boiteDuChemin, contour, remplirVariantes, trace, VARIANTES } from './traces.js';

const MAX_ETAPES = 26;
const lettre = i => String.fromCharCode(65 + i);
const genre = (i, n) => (i === 0 ? 'depart' : i === n - 1 ? 'arrivee' : 'etape');

export class PanneauTrajet {
    constructor(section, contexte) {
        this.c = contexte;
        this.champs = [];
        this.etapes = [];
        this.resultat = null;
        this.numero = 0;
        // le champ que remplit le prochain clic sur le plan ; null : une nouvelle étape
        this.cible = 0;
        this.liste = section.querySelector('[data-etapes]');
        this.suivante = section.querySelector('[data-etape-suivante]');
        this.variante = section.querySelector('[data-variante]');
        this.sortie = section.querySelector('[data-resultat]');
        remplirVariantes(this.variante, 'partout');
        this.suivante.addEventListener('click', () => {
            const champ = this.ajouter(null);
            this.viser(this.champs.length - 1);
            champ.saisie.focus();
        });
        section.querySelector('[data-inverser]').addEventListener('click', () => this.inverser());
        section.querySelector('[data-effacer]').addEventListener('click', () => this.effacer());
        this.variante.addEventListener('change', () => this.calculer());
        this.effacer();
    }

    activer() {
        this.c.plan.montrer('trajet', true);
        this.c.plan.modeChoix(true);
    }

    desactiver() {
        this.c.plan.montrer('trajet', false);
        this.c.plan.modeChoix(false);
    }

    // --- Les étapes -------------------------------------------------------------------------

    ajouter(repere) {
        const champ = new ChampRepere({ catalogue: this.c.catalogue, liste: 'dp-catalogue' });
        champ.definir(repere, false);
        champ.addEventListener('activer', () => this.viser(this.champs.indexOf(champ)));
        champ.addEventListener('change', () => {
            this.viser(this.premiereVide());
            this.calculer();
        });
        champ.addEventListener('retirer', () => this.retirer(champ));
        this.champs.push(champ);
        this.liste.append(champ.element);
        this.situer();
        return champ;
    }

    retirer(champ) {
        this.champs.splice(this.champs.indexOf(champ), 1);
        champ.element.remove();
        this.situer();
        this.viser(this.premiereVide());
        this.calculer();
    }

    // La lettre, le libellé et le bouton de retrait de chaque étape, selon sa place
    situer() {
        const n = this.champs.length;
        this.champs.forEach((champ, i) => champ.situer({
            lettre: lettre(i),
            libelle: { depart: 'Départ', etape: 'Étape', arrivee: 'Arrivée' }[genre(i, n)],
            genre: genre(i, n),
            retirable: n > 2,
        }));
        this.suivante.hidden = n >= MAX_ETAPES;
        this.suivante.querySelector('.pastille').textContent = lettre(n);
        this.marquer();
    }

    premiereVide() {
        const i = this.champs.findIndex(c => !c.repere);
        return i >= 0 ? i : null;
    }

    viser(i) {
        this.cible = i;
        this.marquer();
    }

    marquer() {
        this.champs.forEach((champ, i) => (champ.actif = i === this.cible));
        const nouvelle = this.cible === null;
        this.suivante.classList.toggle('extremite--active', nouvelle);
        this.suivante.querySelector('[data-texte]').textContent = nouvelle
            ? `Prochain clic sur le plan : étape ${lettre(this.champs.length)}`
            : 'Ajouter une étape';
    }

    // Un clic sur le plan remplit l'étape visée, puis la première étape vide, puis en ajoute une
    choisir(clic) {
        const repere = this.c.catalogue.depuisPlan(clic, this.c.reglages.rayonPorte);
        if (this.cible === null) {
            if (this.champs.length >= MAX_ETAPES) {
                return;
            }
            this.ajouter(repere);
        } else {
            this.champs[this.cible].definir(repere, false);
        }
        this.viser(this.premiereVide());
        this.calculer();
    }

    inverser() {
        const reperes = this.champs.map(c => c.repere).reverse();
        this.champs.forEach((c, i) => c.definir(reperes[i], false));
        this.viser(this.premiereVide());
        this.calculer();
    }

    effacer() {
        this.champs.forEach(c => c.element.remove());
        this.champs = [];
        this.ajouter(null);
        this.ajouter(null);
        this.viser(0);
        this.calculer();
    }

    // --- Le calcul --------------------------------------------------------------------------

    // Le terrain ou la marge ont changé
    terrainChange() {
        this.calculer();
    }

    // L'échelle, l'arrondi ou les allures ont changé
    rafraichir() {
        this.rendre();
    }

    async calculer() {
        const numero = ++this.numero;
        this.resultat = null;
        this.erreur = null;
        try {
            this.etapes = this.champs.flatMap((champ, i) => (champ.repere
                ? [{ lettre: lettre(i), repere: champ.repere, geo: this.c.reperes.geometrie(champ.repere) }]
                : []));
        } catch (e) {
            this.etapes = [];
            this.erreur = e.message;
        }
        this.calcul = this.etapes.length >= 2;
        this.rendre();
        if (!this.calcul) {
            return;
        }
        try {
            await this.c.pret;
            const r = await this.c.moteur.itineraire(this.etapes.map(e => e.geo), this.variante.value, this.c.reglages.marge, (fait, total) => {
                const message = this.sortie.querySelector('.message');
                if (numero === this.numero && total > 1 && message) {
                    message.textContent = `Calcul du chemin : vers ${this.etapes[fait + 1].lettre} (${fait + 1}/${total})…`;
                }
            });
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
        const chemins = this.chemins();
        if (chemins.length) {
            this.c.plan.montrerBoite(reunion(chemins.map(boiteDuChemin)), 64);
        }
    }

    chemins() {
        return (this.resultat?.troncons ?? []).map(t => t.chemin).filter(Boolean);
    }

    // --- L'affichage ------------------------------------------------------------------------

    message(texte, erreur = false) {
        this.sortie.replaceChildren(creer('p', { class: `message${erreur ? ' message--erreur' : ''}` }, texte));
    }

    rendre() {
        this.dessiner();
        const r = this.resultat;
        const { reglages } = this.c;
        if (this.erreur) {
            this.message(this.erreur, true);
            return;
        }
        if (this.calcul) {
            this.message('Calcul du chemin…');
            return;
        }
        if (!r) {
            this.message('Choisissez au moins un départ et une arrivée.');
            return;
        }
        const conseil = this.variante.value === 'partout' ? '' : ' Essayez « Partout, à travers champs ».';
        const sansAcces = r.acces.findIndex(n => !n);
        if (sansAcces >= 0) {
            this.message(`L'étape ${this.etapes[sansAcces].lettre} n'a aucun accès praticable dans cette variante.${conseil}`, true);
            return;
        }
        if (r.sansChemin !== null || r.distance === null) {
            const k = r.sansChemin ?? 0;
            this.message(`Aucun chemin de ${this.etapes[k].lettre} à ${this.etapes[k + 1].lettre} dans cette variante.${conseil}`, true);
            return;
        }
        const allures = Object.entries(reglages.vitesses);
        const plusieurs = r.troncons.length > 1;
        this.sortie.replaceChildren(...[
            creer('p', { class: 'mesure' },
                creer('strong', {}, texteMetres(r.distance, reglages)), ' ',
                creer('span', {}, VARIANTES[this.variante.value].libelle.toLowerCase() + (plusieurs ? `, ${this.etapes.length} étapes` : ''))),
            creer('dl', { class: 'details' },
                creer('div', {}, creer('dt', {}, "À vol d'oiseau"), creer('dd', {}, `${texteMetres(r.volDOiseau, reglages)}, détour ×${INSECABLE}${texteNombre(r.distance / Math.max(1, r.volDOiseau), 2)}`)),
                allures.map(([allure, kmh]) => creer('div', {}, creer('dt', {}, `${allure} (${texteNombre(kmh, 1)} km/h)`), creer('dd', {}, texteDuree(r.distance, kmh, reglages)))),
                creer('div', {}, creer('dt', {}, 'Longueur exacte'), creer('dd', {}, texteBrut(r.distance, reglages)))),
            plusieurs ? this.tableTroncons(allures) : null,
            creer('div', { class: 'rangee' },
                creer('button', { type: 'button', class: 'bouton', onclick: () => this.c.plan.cadrer(reunion(this.chemins().map(boiteDuChemin)), 64) }, 'Voir tout le trajet'),
                creer('button', { type: 'button', class: 'bouton', onclick: e => boutonCopier(e.currentTarget, () => this.tableauWiki()) }, 'Copier pour le wiki')),
        ].filter(Boolean));
    }

    // Le détail de chaque tronçon ; survoler une ligne montre le tronçon sur le plan
    tableTroncons(allures) {
        const { reglages } = this.c;
        const table = creer('table', { class: 'troncons' },
            creer('thead', {}, creer('tr', {}, creer('th', { scope: 'col' }, 'Tronçon'), creer('th', { scope: 'col' }, 'Distance'), allures.map(([a]) => creer('th', { scope: 'col' }, a)))),
            creer('tbody', {}, this.resultat.troncons.map((t, k) => creer('tr', { 'data-troncon': k, tabindex: 0 },
                creer('th', { scope: 'row', title: `${this.etapes[k].repere.nom} → ${this.etapes[k + 1].repere.nom}` }, `${this.etapes[k].lettre} → ${this.etapes[k + 1].lettre}`),
                creer('td', {}, texteMetres(t.distance, reglages)),
                allures.map(([, kmh]) => creer('td', {}, texteDuree(t.distance, kmh, reglages)))))));
        const survoler = el => this.survoler(el ? Number(el.dataset.troncon) : null);
        table.addEventListener('pointerover', e => survoler(e.target.closest('[data-troncon]')));
        table.addEventListener('focusin', e => survoler(e.target.closest('[data-troncon]')));
        table.addEventListener('pointerleave', () => survoler(null));
        table.addEventListener('focusout', () => survoler(null));
        return creer('div', { class: 'defile' }, table);
    }

    survoler(k) {
        for (const g of this.c.plan.couche('trajet').g.querySelectorAll('[data-troncon]')) {
            g.classList.toggle('trace--survol', Number(g.dataset.troncon) === k);
        }
    }

    // Les tronçons en tableau du wiki ; à plus de deux étapes, l'itinéraire entier en dernière ligne
    tableauWiki() {
        const { reglages } = this.c;
        const r = this.resultat;
        const allures = Object.values(reglages.vitesses);
        const colonne = this.variante.value === 'partout' ? 'Par les chemins' : 'Par les rues';
        const ligne = (etapes, vol, distance) => [
            etapes.map(e => libelleDe(e.repere)).join(' → '),
            texteMetres(vol, reglages),
            texteMetres(distance, reglages),
            ...allures.map(kmh => texteDuree(distance, kmh, reglages)),
        ];
        const lignes = r.troncons.map((t, k) => ligne(this.etapes.slice(k, k + 2), t.volDOiseau, t.distance));
        if (r.troncons.length > 1) {
            lignes.push(ligne(this.etapes, r.volDOiseau, r.distance));
        }
        return tableauWiki(['Trajet', "Vol d'oiseau", colonne, ...Object.keys(reglages.vitesses)], lignes);
    }

    dessiner() {
        const { plan } = this.c;
        const n = this.etapes.length;
        const troncons = this.resultat?.troncons ?? [];
        plan.dessiner('trajet',
            this.etapes.map((e, i) => contour(e.geo, `contour--${genre(i, n)}`)),
            troncons.map((t, k) => {
                if (!t.chemin) {
                    return null;
                }
                const g = trace(t.chemin, 'trace--trajet');
                g.dataset.troncon = k;
                return g;
            }));
        // chaque tronçon part de son arrivée : une étape est au bout du tronçon qui en part, la
        // dernière au début du tronçon qui y mène
        plan.etiqueter('trajet', this.etapes.map((e, i) => {
            const sortant = troncons[i]?.chemin;
            const entrant = troncons[i - 1]?.chemin;
            const [x, y] = sortant ? [sortant[sortant.length - 2], sortant[sortant.length - 1]] : entrant ? [entrant[0], entrant[1]] : centre(e.geo);
            return { x, y, texte: e.lettre, classe: `etiquette--${genre(i, n)}`, titre: e.repere.nom };
        }));
    }
}
