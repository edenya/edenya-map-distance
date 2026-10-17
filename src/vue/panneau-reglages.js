// L'onglet Réglages : l'échelle, l'arrondi, les allures et les rayons du terrain, et la
// configuration à télécharger (la page ne peut pas écrire le fichier elle-même).

import { creer } from './dom.js';
import { telecharger } from './exports.js';

// Les réglages numériques, par clé de la configuration : [libellé, pas, minimum]
const NOMBRES = {
    echelle: ['Mètres par unité du plan', 0.01, 0.01],
    arrondi: ['Arrondi des distances (m), à 5 m sous 100 m', 1, 1],
    rayon_porte: ['Ouverture des portes dans la muraille (rayon, en unités)', 1, 1],
    marge_batiment: ["Bande autour d'un bâtiment où chercher sa porte (unités)", 1, 0],
    rayon_places: ['Rayon des places par défaut (unités)', 1, 1],
};

export class PanneauReglages {
    constructor(section, contexte) {
        this.c = contexte;
        const { reglages, ville } = contexte;
        for (const champ of section.querySelectorAll('[data-reglages]')) {
            champ.append(...champ.dataset.reglages.split(' ').map(cle => this.nombre(cle, ...NOMBRES[cle])));
        }
        this.vitesses = section.querySelector('[data-vitesses]');
        this.rendreVitesses();
        section.querySelector('[data-telecharger-config]').addEventListener('click', () => telecharger(`${ville.cle}.json`, reglages.json()));
        const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(ville.lieux.exporte));
        section.querySelector('[data-export]').textContent = `Plan et contours des bâtiments exportés du jeu le ${date} (${ville.lieux.batiments.length} bâtiments, ${ville.lieux.lieux.length} lieux).`;
    }

    nombre(cle, libelle, pas, minimum) {
        const entree = creer('input', { type: 'number', step: pas, min: minimum, value: this.c.reglages.config[cle] ?? '', required: true });
        entree.addEventListener('change', () => {
            const v = Number(entree.value);
            if (entree.value === '' || !(v >= minimum)) {
                entree.value = this.c.reglages.config[cle];
                return;
            }
            this.c.reglages.modifier(cle, v);
        });
        return creer('label', { class: 'champ' }, creer('span', {}, libelle), entree);
    }

    rendreVitesses() {
        const vitesses = this.c.reglages.vitesses;
        this.vitesses.replaceChildren(...Object.entries(vitesses).map(([allure, kmh]) => {
            const entree = creer('input', { type: 'number', step: 0.1, min: 0.1, value: kmh, required: true });
            entree.addEventListener('change', () => {
                const v = Number(entree.value);
                if (!(v > 0)) {
                    entree.value = this.c.reglages.vitesses[allure];
                    return;
                }
                this.c.reglages.modifier('vitesses', { ...this.c.reglages.vitesses, [allure]: v });
            });
            return creer('label', { class: 'champ' }, creer('span', {}, `${allure} (km/h)`), entree);
        }));
    }
}
