// Le point d'entrée : charge la ville, monte le plan et les onglets, prépare le terrain dans le
// moteur, puis relaie les clics du plan à l'onglet ouvert et les réglages aux onglets.
// ?ville=<nom> choisit une ville de villes/villes.json (la première par défaut).

import { Catalogue } from './donnees/catalogue.js';
import { chargerVille, cheminsDesCalques } from './donnees/chargement.js';
import { Reperes } from './donnees/reperes.js';
import { Moteur } from './moteur/client.js';
import { Reglages } from './reglages.js';
import { Onglets } from './vue/onglets.js';
import { PanneauPlaces } from './vue/panneau-places.js';
import { PanneauReglages } from './vue/panneau-reglages.js';
import { PanneauTableaux } from './vue/panneau-tableaux.js';
import { PanneauTrajet } from './vue/panneau-trajet.js';
import { PALETTE, Plan } from './vue/plan.js';
import { Separateur } from './vue/separateur.js';
import { Statut } from './vue/statut.js';

const PANNEAUX = { trajet: PanneauTrajet, tableaux: PanneauTableaux, places: PanneauPlaces, reglages: PanneauReglages };

const statut = new Statut(document.querySelector('[data-statut]'));

async function demarrer() {
    statut.afficher('Chargement du plan…');
    const ville = await chargerVille(new URLSearchParams(location.search).get('ville'));
    const configuration = ville.configuration;
    document.title = `Distances à ${ville.titre}`;
    document.querySelector('[data-ville]').textContent = ville.titre;

    const reglages = new Reglages(configuration);
    const catalogue = new Catalogue(ville.lieux, configuration);
    catalogue.remplir(document.getElementById('dp-catalogue'));
    const plan = new Plan(document.querySelector('[data-plan]'), ville, catalogue);
    const moteur = new Moteur();
    let terrainPret;
    const contexte = {
        ville, reglages, catalogue, plan, moteur, statut,
        reperes: new Reperes(ville.lieux, configuration.portes),
        interieurLibre: 0,
        // les onglets attendent le terrain avant leur premier calcul
        pret: new Promise(r => (terrainPret = r)),
    };
    const panneaux = {};
    for (const [nom, Panneau] of Object.entries(PANNEAUX)) {
        panneaux[nom] = new Panneau(document.querySelector(`[data-panneau="${nom}"]`), contexte);
    }
    const onglets = new Onglets(document.querySelector('[role="tablist"]'), panneaux);
    plan.addEventListener('choix', e => onglets.panneau.choisir?.(e.detail));
    new Separateur(document.querySelector('[data-separateur]'));

    statut.afficher('Préparation du terrain…');
    const terrain = await moteur.preparer({
        largeur: ville.largeur,
        hauteur: ville.hauteur,
        calques: cheminsDesCalques(ville.dessin, configuration.calques),
        interieur: configuration.interieur,
        portes: configuration.portes,
        rayonPorte: reglages.rayonPorte,
        palette: PALETTE,
    }, (fait, total, texte) => statut.afficher(`Préparation du terrain : ${texte.toLowerCase()}…`, fait / total));
    plan.definirControle(terrain.controle);
    contexte.interieurLibre = terrain.interieurLibre;
    terrainPret();
    statut.effacer();
    panneaux.places.rafraichir();

    const tous = methode => Object.values(panneaux).forEach(p => p[methode]?.());
    reglages.addEventListener('change', async ({ detail: { cle } }) => {
        if (cle === 'rayon_porte') {
            statut.afficher('Réouverture des portes…');
            try {
                plan.definirControle((await moteur.portes(configuration.portes, reglages.rayonPorte)).controle);
                statut.effacer();
            } catch (e) {
                statut.erreur(e.message);
            }
            tous('terrainChange');
        } else if (cle === 'marge_batiment') {
            tous('terrainChange');
        } else if (cle === 'rayon_places') {
            panneaux.places.liste.rendre();
            panneaux.places.terrainChange();
        } else if (['echelle', 'arrondi', 'vitesses'].includes(cle)) {
            tous('rafraichir');
        }
    });
}

demarrer().catch(e => {
    statut.erreur(e.message);
    console.error(e);
});
