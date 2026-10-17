// Tout ce qu'on peut prendre pour repère, sous un libellé unique (les listes de choix) : les
// repères de la configuration, les portes, les lieux du plan, puis chaque bâtiment.

import { cleDe } from './reperes.js';

const TYPES = { maison: 'Maison', guilde: 'Guilde', commerce: 'Commerce', arene: 'Arène', special: 'Lieu' };

export class Catalogue {
    constructor(lieux, configuration) {
        this.quartiers = lieux.quartiers ?? {};
        this.portes = configuration.portes ?? {};
        this.entrees = [];
        this.parLibelle = new Map();
        this.cles = new Map();
        for (const groupe of ['en_ville', 'hors_les_murs']) {
            for (const r of configuration[groupe] ?? []) {
                this.ajouter(r.nom, r);
            }
        }
        for (const nom of Object.keys(this.portes)) {
            this.ajouter(nom, { nom, porte: nom });
        }
        for (const l of lieux.lieux) {
            this.ajouter(l.titre, { nom: l.titre, lieu: l.titre });
        }
        const batiments = [...lieux.batiments].sort((a, b) => Number(!a.nom) - Number(!b.nom));
        for (const b of batiments) {
            this.ajouter(this.titreBatiment(b), this.repereBatiment(b));
        }
    }

    ajouter(libelle, repere) {
        const cle = cleDe(repere);
        if (this.cles.has(cle)) {
            return;
        }
        let unique = libelle;
        for (let i = 2; this.parLibelle.has(unique); i++) {
            unique = `${libelle} (${i})`;
        }
        this.cles.set(cle, unique);
        this.parLibelle.set(unique, repere);
        this.entrees.push({ libelle: unique, repere });
    }

    // Le repère d'un libellé de la liste (une copie), null s'il n'y est pas
    trouver(libelle) {
        const r = this.parLibelle.get(libelle.trim());
        return r ? structuredClone(r) : null;
    }

    // Le libellé d'un repère dans la liste, ou son nom s'il n'y est pas
    libelle(repere) {
        return this.cles.get(cleDe(repere)) ?? repere.nom;
    }

    // La liste de choix (<datalist>) de tout le catalogue
    remplir(datalist) {
        datalist.replaceChildren(...this.entrees.map(e => Object.assign(document.createElement('option'), { value: e.libelle })));
    }

    adresse(b) {
        return `${this.quartiers[b.secteur] ?? b.secteur}, n°${b.numero}`;
    }

    // « Touchons du bois (Quartier du Grand Chêne, n°6) », ou l'adresse seule
    titreBatiment(b) {
        return b.nom ? `${b.nom} (${this.adresse(b)})` : this.adresse(b);
    }

    repereBatiment(b) {
        return { nom: b.nom ?? `${TYPES[b.type] ?? 'Bâtiment'} ${b.secteur} ${b.numero}`, batiment: [b.secteur, b.numero] };
    }

    // Le repère d'un clic sur le plan : la forme cliquée, une porte à moins de rayon unités, ou le point
    depuisPlan({ x, y, forme }, rayonPorte) {
        if (forme?.batiment) {
            return this.repereBatiment(forme.batiment);
        }
        if (forme?.lieu) {
            return { nom: forme.lieu.titre, lieu: forme.lieu.titre };
        }
        for (const [nom, [px, py]] of Object.entries(this.portes)) {
            if (Math.hypot(px - x, py - y) <= rayonPorte) {
                return { nom, porte: nom };
            }
        }
        const point = [Math.round(x), Math.round(y)];
        return { nom: `Point ${point.join(', ')}`, point };
    }
}
