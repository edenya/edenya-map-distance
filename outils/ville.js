// Une ville exportée, lue depuis le disque (l'outil en ligne de commande et les tests) : son entrée
// dans villes.json, sa configuration, son dessin, ses lieux, les chemins SVG de ses calques.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VILLES = resolve(dirname(fileURLToPath(import.meta.url)), '../public/villes');

const echapper = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function chargerVille(cle = null, dossier = VILLES) {
    const lire = (chemin, json = true) => {
        const texte = readFileSync(join(dossier, chemin), 'utf8');
        return json ? JSON.parse(texte) : texte;
    };
    let villes;
    try {
        villes = lire('villes.json');
    } catch (e) {
        throw new Error(`Aucune ville exportée (npm run exporter) : ${e.message}`);
    }
    cle ??= Object.keys(villes)[0];
    const entree = villes[cle];
    if (!entree) {
        throw new Error(`Ville inconnue : ${cle} (exportées : ${Object.keys(villes).join(', ')})`);
    }
    const configuration = lire(entree.configuration);
    const dessin = lire(entree.dessin, false);
    const [, , largeur, hauteur] = dessin.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
    // le dessin a un chemin par calque : son attribut d, trouvé par l'id du calque
    const chemin = id => {
        const balise = dessin.match(new RegExp(`<[a-zA-Z]+\\b[^>]*\\sid="${echapper(id)}"[^>]*>`));
        const d = balise?.[0].match(/\sd="([^"]*)"/)?.[1];
        if (!d) {
            throw new Error(`Calque introuvable dans le dessin : ${id}`);
        }
        return d;
    };
    const calques = Object.fromEntries(Object.entries(configuration.calques).map(([role, ids]) => [role, ids.map(chemin)]));
    return { cle, titre: entree.titre, configuration, lieux: lire(entree.lieux), calques, largeur, hauteur };
}
