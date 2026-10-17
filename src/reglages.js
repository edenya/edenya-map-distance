// La configuration de la ville telle que la page la modifie (réglages, repères, places,
// trajets), avec ses valeurs par défaut. Chaque modification émet « change » ({ cle }).
// Elle ne vit que dans la page : json() la rend pour remplacer le fichier.

export class Reglages extends EventTarget {
    constructor(configuration) {
        super();
        this.config = structuredClone(configuration);
    }

    get echelle() {
        return Number(this.config.echelle) || 0.5;
    }

    get arrondi() {
        return Number(this.config.arrondi) || 10;
    }

    // { allure: km/h } ; l'ancienne clé marche_kmh vaut « À pied »
    get vitesses() {
        return this.config.vitesses ?? { 'À pied': Number(this.config.marche_kmh) || 4.5 };
    }

    get rayonPorte() {
        return Number(this.config.rayon_porte ?? 30);
    }

    get marge() {
        return Number(this.config.marge_batiment ?? 6);
    }

    get rayonPlaces() {
        return Number(this.config.rayon_places ?? 18);
    }

    // La variante des trajets choisis en ville (« ouvert » par défaut)
    get varianteTrajets() {
        return this.config.variante_trajets ?? 'ouvert';
    }

    modifier(cle, valeur) {
        this.config[cle] = valeur;
        this.dispatchEvent(new CustomEvent('change', { detail: { cle } }));
    }

    // Les repères d'un groupe (en_ville, hors_les_murs, places), modifiables en place puis signalés
    groupe(nom) {
        this.config[nom] ??= [];
        return this.config[nom];
    }

    signaler(cle) {
        this.dispatchEvent(new CustomEvent('change', { detail: { cle } }));
    }

    // Un repère renommé : les trajets choisis qui le citaient suivent
    renommer(groupe, ancien, nouveau) {
        for (const paire of this.config.trajets?.[groupe] ?? []) {
            paire.forEach((nom, i) => {
                if (nom === ancien) {
                    paire[i] = nouveau;
                }
            });
        }
    }

    json() {
        return JSON.stringify(this.config, null, 4) + '\n';
    }
}
