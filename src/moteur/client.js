// Le moteur vu de la page : chaque demande au Web Worker est une promesse. Les demandes passent
// une à une, dans l'ordre ; progression(fait, total, texte) suit les longs calculs.

export class Moteur {
    constructor() {
        this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        this.attentes = new Map();
        this.suivant = 1;
        this.worker.onmessage = ({ data }) => this.recevoir(data);
        this.worker.onerror = e => {
            e.preventDefault();
            for (const { rejeter } of this.attentes.values()) {
                rejeter(new Error(e.message || 'Le moteur de calcul ne démarre pas.'));
            }
            this.attentes.clear();
        };
    }

    recevoir({ id, progression, resultat, erreur }) {
        const attente = this.attentes.get(id);
        if (!attente) {
            return;
        }
        if (progression) {
            attente.progression?.(progression.fait, progression.total, progression.texte);
            return;
        }
        this.attentes.delete(id);
        if (erreur !== undefined) {
            attente.rejeter(new Error(erreur));
        } else {
            attente.resoudre(resultat);
        }
    }

    demander(type, donnees = {}, progression = null) {
        const id = this.suivant++;
        return new Promise((resoudre, rejeter) => {
            this.attentes.set(id, { resoudre, rejeter, progression });
            this.worker.postMessage({ id, type, ...donnees });
        });
    }

    // Dessine le terrain : { largeur, hauteur, calques, interieur, portes, rayonPorte, palette }
    preparer(donnees, progression) {
        return this.demander('preparer', donnees, progression);
    }

    portes(portes, rayonPorte) {
        return this.demander('portes', { portes, rayonPorte });
    }

    trajet(depart, arrivee, variante, marge) {
        return this.demander('trajet', { depart, arrivee, variante, marge });
    }

    // Le plus court chemin qui passe par chaque étape, dans l'ordre
    itineraire(etapes, variante, marge, progression) {
        return this.demander('itineraire', { etapes, variante, marge }, progression);
    }

    matrice(reperes, variante, marge, progression) {
        return this.demander('matrice', { reperes, variante, marge }, progression);
    }

    places(places, progression) {
        return this.demander('places', { places }, progression);
    }
}
