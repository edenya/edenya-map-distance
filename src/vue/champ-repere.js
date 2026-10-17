// Un champ qui choisit un repère : dans la liste du catalogue, ou par un clic sur le plan quand
// il est actif ; pour un bâtiment ou un lieu, « au centre ». Émet « change » quand le repère
// change, « activer » quand on le prend en main.

import { aUneForme } from '../donnees/reperes.js';
import { creer } from './dom.js';

export class ChampRepere extends EventTarget {
    // options : { libelle, pastille, classe, catalogue, liste (id du datalist) }
    constructor(options) {
        super();
        this.catalogue = options.catalogue;
        this.repere = null;
        this.saisie = creer('input', { type: 'search', list: options.liste, autocomplete: 'off', placeholder: 'Choisir dans la liste ou cliquer sur le plan' });
        this.centre = creer('input', { type: 'checkbox', disabled: true });
        this.erreur = creer('span', { class: 'champ__erreur', hidden: true }, 'Inconnu : choisissez un repère de la liste.');
        this.element = creer('div', { class: `extremite ${options.classe ?? ''}` },
            creer('span', { class: 'pastille', 'aria-hidden': 'true' }, options.pastille),
            creer('label', { class: 'champ extremite__champ' }, creer('span', {}, options.libelle), this.saisie),
            creer('label', { class: 'case', title: 'Viser le milieu de sa forme plutôt que son pourtour' }, this.centre, 'Au centre'),
            this.erreur);
        this.saisie.addEventListener('change', () => this.lire());
        this.centre.addEventListener('change', () => {
            if (this.repere) {
                this.repere.centre = this.centre.checked;
                this.emettre();
            }
        });
        this.element.addEventListener('focusin', () => this.dispatchEvent(new Event('activer')));
        this.element.addEventListener('pointerdown', () => this.dispatchEvent(new Event('activer')));
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

    definir(repere) {
        this.repere = repere;
        this.saisie.value = repere ? this.catalogue.libelle(repere) : '';
        this.erreur.hidden = true;
        this.saisie.removeAttribute('aria-invalid');
        this.centre.disabled = !repere || !aUneForme(repere);
        this.centre.checked = Boolean(repere?.centre);
        this.emettre();
    }

    emettre() {
        this.dispatchEvent(new Event('change'));
    }

    set actif(actif) {
        this.element.classList.toggle('extremite--active', actif);
    }
}
