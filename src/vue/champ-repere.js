// Un champ qui choisit un repère : dans la liste du catalogue, ou par un clic sur le plan quand
// il est actif ; pour un bâtiment ou un lieu, « au centre ». Émet « change » quand le repère
// change, « activer » quand on le prend en main, « retirer » quand on demande à l'enlever.

import { aUneForme } from '../donnees/reperes.js';
import { creer } from './dom.js';

export class ChampRepere extends EventTarget {
    // options : { catalogue, liste (id du datalist) } ; sa place dans l'itinéraire : situer()
    constructor(options) {
        super();
        this.catalogue = options.catalogue;
        this.repere = null;
        this.pastille = creer('span', { class: 'pastille', 'aria-hidden': 'true' });
        this.libelle = creer('span', { class: 'invisible' });
        this.saisie = creer('input', { type: 'search', list: options.liste, autocomplete: 'off', placeholder: 'Choisir dans la liste ou cliquer sur le plan' });
        this.centre = creer('input', { type: 'checkbox' });
        this.caseCentre = creer('label', { class: 'case', title: 'Viser le milieu de sa forme plutôt que son pourtour', hidden: true }, this.centre, 'centre');
        this.erreur = creer('span', { class: 'champ__erreur', hidden: true }, 'Inconnu : choisissez un repère de la liste.');
        this.retirer = creer('button', { type: 'button', class: 'bouton-icone bouton-icone--discret', title: 'Retirer cette étape' }, '×');
        this.element = creer('div', { class: 'extremite' },
            this.pastille,
            creer('label', { class: 'extremite__champ' }, this.libelle, this.saisie),
            this.caseCentre,
            this.retirer,
            this.erreur);
        this.saisie.addEventListener('change', () => this.lire());
        this.centre.addEventListener('change', () => {
            if (this.repere) {
                this.repere.centre = this.centre.checked;
                this.emettre();
            }
        });
        this.retirer.addEventListener('click', () => this.dispatchEvent(new Event('retirer')));
        this.element.addEventListener('focusin', () => this.dispatchEvent(new Event('activer')));
        this.element.addEventListener('pointerdown', () => this.dispatchEvent(new Event('activer')));
    }

    // Sa place : { lettre, libelle (« Départ », « Étape », « Arrivée »), genre (depart, etape,
    // arrivee), retirable }
    situer({ lettre, libelle, genre, retirable }) {
        this.pastille.textContent = lettre;
        this.pastille.title = `${libelle} (${lettre})`;
        this.libelle.textContent = `${libelle} (${lettre})`;
        this.element.classList.remove('extremite--depart', 'extremite--etape', 'extremite--arrivee');
        this.element.classList.add(`extremite--${genre}`);
        this.retirer.hidden = !retirable;
        this.retirer.setAttribute('aria-label', `Retirer l'étape ${lettre}`);
    }

    lire() {
        const texte = this.saisie.value.trim();
        const repere = texte ? this.catalogue.trouver(texte) : null;
        this.erreur.hidden = !texte || Boolean(repere);
        this.saisie.setAttribute('aria-invalid', String(!this.erreur.hidden));
        if (repere || !texte) {
            this.definir(repere);
        }
    }

    // Change le repère ; emettre: false quand l'appelant recalcule lui-même
    definir(repere, emettre = true) {
        this.repere = repere;
        this.saisie.value = repere ? this.catalogue.libelle(repere) : '';
        this.erreur.hidden = true;
        this.saisie.removeAttribute('aria-invalid');
        // seuls un bâtiment et un lieu ont un centre à viser
        this.caseCentre.hidden = !repere || !aUneForme(repere);
        this.centre.checked = Boolean(repere?.centre);
        if (emettre) {
            this.emettre();
        }
    }

    emettre() {
        this.dispatchEvent(new Event('change'));
    }

    set actif(actif) {
        this.element.classList.toggle('extremite--active', actif);
    }
}
