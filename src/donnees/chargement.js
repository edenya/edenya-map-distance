// Le chargement d'une ville : la liste des villes exportées (villes/villes.json, à côté de la page),
// puis sa configuration, son dessin et ses lieux. Les chemins de villes.json partent de villes/.

// relatif à la page : une fois l'application construite, import.meta.url désigne un fichier de assets/
const DONNEES = new URL('villes/', document.baseURI);

async function lire(url, comment) {
    const reponse = await fetch(url, { cache: 'no-cache' });
    if (!reponse.ok) {
        throw new Error(`${decodeURIComponent(url.pathname)} : ${reponse.status} ${reponse.statusText}`);
    }
    return comment === 'json' ? reponse.json() : reponse.text();
}

export async function chargerVille(nom = null) {
    let villes;
    try {
        villes = await lire(new URL('villes.json', DONNEES), 'json');
    } catch (e) {
        throw new Error(`Aucune ville exportée (npm run exporter) : ${e.message}`);
    }
    const cle = nom ?? Object.keys(villes)[0];
    const entree = villes[cle];
    if (!entree) {
        throw new Error(`Ville inconnue : ${cle} (exportées : ${Object.keys(villes).join(', ')})`);
    }
    const urlDessin = new URL(entree.dessin, DONNEES);
    const [configuration, texte, lieux] = await Promise.all([
        lire(new URL(entree.configuration, DONNEES), 'json'),
        lire(urlDessin, 'texte'),
        lire(new URL(entree.lieux, DONNEES), 'json'),
    ]);
    const dessin = new DOMParser().parseFromString(texte, 'image/svg+xml');
    if (dessin.querySelector('parsererror')) {
        throw new Error(`${entree.dessin} : le dessin ne se lit pas`);
    }
    const [, , largeur, hauteur] = dessin.documentElement.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    return { cle, titre: entree.titre, configuration, dessin, largeur, hauteur, lieux, urlDessin };
}

// Les chemins SVG (attribut d) des calques du dessin qui jouent chaque rôle (configuration.calques)
export function cheminsDesCalques(dessin, calques) {
    const chemins = {};
    for (const [role, ids] of Object.entries(calques)) {
        chemins[role] = ids.map(id => {
            const d = dessin.getElementById(id)?.getAttribute('d');
            if (!d) {
                throw new Error(`Calque introuvable dans le dessin : ${id}`);
            }
            return d;
        });
    }
    return chemins;
}
