// La liste modifiable des repères d'un groupe de la configuration (en_ville, hors_les_murs,
// places) : renommer, viser le centre, changer le rayon (places), retirer, ajouter depuis la
// liste du catalogue ou par des clics sur le plan. Émet « change » quand la liste change et
// « mode » quand l'ajout par le plan s'allume ou s'éteint (this.ajoutParLePlan).

import { aUneForme } from '../donnees/reperes.js';
import { creer } from './dom.js';

const GENRES = [['batiment', 'bât.', 'Un bâtiment'], ['lieu', 'lieu', 'Un lieu du plan'], ['porte', 'porte', 'Une porte'], ['point', 'point', 'Un point du plan']];

export class ListeReperes extends EventTarget {
    // options : { reglages, catalogue, liste (id du datalist), places (des points avec un rayon) }
    constructor(options) {
        super();
        this.reglages = options.reglages;
        this.catalogue = options.catalogue;
        this.places = Boolean(options.places);
        this.nom = null;
        this.ajoutParLePlan = false;
        this.ol = creer('ol', { class: 'liste-reperes' });
        this.saisie = creer('input', { type: 'search', list: options.liste, autocomplete: 'off', placeholder: 'Ajouter depuis la liste…', 'aria-label': 'Ajouter un repère depuis la liste', hidden: this.places });
        this.bouton = creer('button', { type: 'button', class: 'bouton', 'aria-pressed': 'false' }, this.places ? 'Ajouter des places sur le plan' : 'Ajouter sur le plan');
        this.element = creer('div', {}, this.ol, creer('div', { class: 'rangee' }, this.saisie, this.bouton));
        this.saisie.addEventListener('change', () => {
            const repere = this.catalogue.trouver(this.saisie.value);
            if (repere) {
                this.ajouter(repere);
                this.saisie.value = '';
            }
        });
        this.bouton.addEventListener('click', () => this.basculerAjout(!this.ajoutParLePlan));
        this.ol.addEventListener('change', e => this.modifier(e));
        this.ol.addEventListener('click', e => {
            const li = e.target.closest('[data-retirer]')?.closest('li');
            if (li) {
                this.reperes.splice(Number(li.dataset.index), 1);
                this.rendre();
                this.emettre();
            }
        });
    }

    get reperes() {
        return this.reglages.groupe(this.nom);
    }

    set groupe(nom) {
        this.nom = nom;
        this.rendre();
    }

    emettre() {
        this.reglages.signaler(this.nom);
        this.dispatchEvent(new Event('change'));
    }

    basculerAjout(actif) {
        this.ajoutParLePlan = actif;
        this.bouton.setAttribute('aria-pressed', String(actif));
        this.dispatchEvent(new Event('mode'));
    }

    // Un nom libre dans le groupe : « Nom », sinon « Nom 2 »…
    nomLibre(nom, sauf = -1) {
        const pris = new Set(this.reperes.filter((_, i) => i !== sauf).map(r => r.nom));
        let libre = nom;
        for (let i = 2; pris.has(libre); i++) {
            libre = `${nom} ${i}`;
        }
        return libre;
    }

    ajouter(repere) {
        if (this.places) {
            repere = { nom: repere.nom, point: repere.point };
        }
        repere.nom = this.nomLibre(repere.nom);
        this.reperes.push(repere);
        this.rendre();
        this.emettre();
    }

    modifier(e) {
        const li = e.target.closest('li');
        const r = this.reperes[Number(li.dataset.index)];
        const champ = e.target.dataset.champ;
        if (champ === 'nom') {
            const nom = this.nomLibre(e.target.value.trim() || r.nom, Number(li.dataset.index));
            this.reglages.renommer(this.nom, r.nom, nom);
            r.nom = nom;
            e.target.value = nom;
        } else if (champ === 'centre') {
            r.centre = e.target.checked;
            if (!r.centre) {
                delete r.centre;
            }
        } else if (champ === 'rayon') {
            const rayon = Math.round(Number(e.target.value));
            if (rayon > 0) {
                r.rayon = rayon;
            } else {
                delete r.rayon;
                e.target.value = '';
            }
        }
        this.emettre();
    }

    rendre() {
        this.ol.replaceChildren(...this.reperes.map((r, i) => {
            const [, court, long] = GENRES.find(([g]) => r[g]) ?? ['', '?', 'Sans position'];
            return creer('li', { dataset: { index: i } },
                creer('span', { class: 'etiquette-genre', title: long }, court),
                creer('input', { type: 'text', value: r.nom, 'data-champ': 'nom', 'aria-label': 'Nom du repère', required: true }),
                aUneForme(r)
                    ? creer('label', { class: 'case', title: 'Viser le milieu de sa forme plutôt que son pourtour' }, creer('input', { type: 'checkbox', 'data-champ': 'centre', checked: Boolean(r.centre) }), 'centre')
                    : null,
                this.places
                    ? creer('label', { class: 'case', title: `Demi-largeur du passage le plus étroit retiré, en unités (${this.reglages.rayonPlaces} par défaut)` }, 'rayon',
                        creer('input', { type: 'number', min: 1, step: 1, value: r.rayon ?? '', placeholder: String(this.reglages.rayonPlaces), 'data-champ': 'rayon', class: 'nombre-court' }))
                    : null,
                creer('button', { type: 'button', class: 'bouton-icone bouton-icone--discret', 'data-retirer': '', 'aria-label': `Retirer ${r.nom}`, title: 'Retirer' }, '×'));
        }));
    }
}
