// Les repères de la configuration et leur géométrie sur le plan.
//
// Un repère : { nom, libelle?, centre?, et sa position, l'une de :
//   lieu: "La tour Blanche"   un lieu du plan sans bâtiment, par son titre ;
//   batiment: ["GU", 25]      un bâtiment, par son secteur et son numéro ;
//   porte: "Porte Nord"       une porte de la configuration ;
//   point: [1650, 820]        un point du plan, en unités }.
// Sa géométrie, ce que le moteur reçoit : { cle, nom, centre, point | poly | cercle }.

export function cleDe(repere) {
    if (repere.batiment) {
        return `batiment:${repere.batiment[0]}-${repere.batiment[1]}`;
    }
    if (repere.lieu) {
        return `lieu:${repere.lieu}`;
    }
    if (repere.porte) {
        return `porte:${repere.porte}`;
    }
    if (repere.point) {
        return `point:${repere.point.join(',')}`;
    }
    return null;
}

// Le nom d'un repère dans les trajets
export const libelleDe = repere => repere.libelle ?? repere.nom;

// Seuls un bâtiment et un lieu du plan ont une forme qu'on peut viser au centre
export const aUneForme = repere => Boolean(repere.batiment || repere.lieu);

export class Reperes {
    // lieux : l'export du jeu (lieux, batiments) ; portes : celles de la configuration
    constructor(lieux, portes) {
        this.lieux = new Map(lieux.lieux.map(l => [l.titre, l]));
        this.batiments = new Map(lieux.batiments.map(b => [`${b.secteur}-${b.numero}`, b]));
        this.portes = portes ?? {};
    }

    batiment(secteur, numero) {
        return this.batiments.get(`${secteur}-${numero}`) ?? null;
    }

    geometrie(repere) {
        const geo = { cle: cleDe(repere), nom: repere.nom, centre: Boolean(repere.centre) };
        if (repere.point) {
            return { ...geo, point: repere.point.map(Number) };
        }
        if (repere.porte) {
            const point = this.portes[repere.porte];
            if (!point) {
                throw new Error(`Porte inconnue : ${repere.porte}`);
            }
            return { ...geo, point };
        }
        if (repere.lieu) {
            const lieu = this.lieux.get(repere.lieu);
            if (!lieu) {
                throw new Error(`Lieu du plan inconnu : ${repere.lieu}`);
            }
            return lieu.cercle ? { ...geo, cercle: lieu.cercle } : { ...geo, poly: lieu.poly };
        }
        if (repere.batiment) {
            const b = this.batiment(...repere.batiment);
            if (!b) {
                throw new Error(`Bâtiment sans contour : ${repere.batiment.join(' ')}`);
            }
            return { ...geo, poly: b.poly };
        }
        throw new Error(`Repère sans position : ${repere.nom}`);
    }
}
