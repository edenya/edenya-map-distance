// Le moteur de calcul dans un Web Worker : le plan est une grille de quelques millions de cases,
// ses calculs (calculs.js) ne doivent pas figer la page. Chaque message { id, type, … } reçoit une
// réponse { id, resultat } ou { id, erreur }, précédée de { id, progression } pour les longs calculs.

import { Calculs } from './calculs.js';

const calculs = new Calculs();
const traitements = {
    preparer: (m, progresser) => calculs.preparer(m, progresser),
    portes: m => calculs.portes(m),
    trajet: m => calculs.trajet(m),
    itineraire: (m, progresser) => calculs.itineraire(m, progresser),
    matrice: (m, progresser) => calculs.matrice(m, progresser),
    places: (m, progresser) => calculs.places(m, progresser),
};

// Les tampons des résultats passent au fil principal sans copie
function transferables(valeur, liste = []) {
    if (ArrayBuffer.isView(valeur)) {
        liste.push(valeur.buffer);
    } else if (Array.isArray(valeur)) {
        valeur.forEach(v => transferables(v, liste));
    } else if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob)) {
        Object.values(valeur).forEach(v => transferables(v, liste));
    }
    return liste;
}

async function traiter({ id, type, ...message }) {
    const progresser = (fait, total, texte) => self.postMessage({ id, progression: { fait, total, texte } });
    try {
        if (!traitements[type]) {
            throw new Error(`Demande inconnue : ${type}`);
        }
        const resultat = await traitements[type](message, progresser);
        self.postMessage({ id, resultat }, transferables(resultat));
    } catch (e) {
        self.postMessage({ id, erreur: e?.message ?? String(e) });
    }
}

// Une demande à la fois, dans l'ordre d'arrivée, même quand l'une attend (l'image de contrôle)
let file = Promise.resolve();
self.onmessage = ({ data }) => {
    file = file.then(() => traiter(data));
};
