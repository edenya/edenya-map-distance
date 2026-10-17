// L'onglet Tableaux : les distances entre tous les repères d'un groupe de la configuration
// (en ville, hors les murs), dans une variante de chemin, et les trajets choisis du wiki. Survoler
// une case montre son chemin sur le plan ; un clic l'épingle.

import { libelleDe } from '../donnees/reperes.js';
import { creer } from './dom.js';
import { boutonCopier, tableauWiki, telecharger } from './exports.js';
import { INSECABLE, metres, minutes, texteDuree, texteMetres, texteNombre } from './format.js';
import { ListeReperes } from './liste-reperes.js';
import { contour, etiquette, remplirVariantes, trace, VARIANTES } from './traces.js';

const GROUPES = { en_ville: 'En ville', hors_les_murs: 'Hors les murs' };

export class PanneauTableaux {
    constructor(section, contexte) {
        this.c = contexte;
        this.section = section;
        this.resultats = new Map();
        this.epingle = null;
        const $ = selecteur => section.querySelector(selecteur);
        this.groupe = $('[data-groupe]');
        this.groupe.replaceChildren(...Object.entries(GROUPES).map(([cle, texte]) => creer('option', { value: cle }, texte)));
        this.variante = $('[data-variante]');
        this.variantes = { en_ville: contexte.reglages.varianteTrajets, hors_les_murs: 'partout' };
        this.compte = $('[data-compte]');
        this.bouton = $('[data-calculer]');
        this.zone = $('[data-resultats]');
        this.attente = $('[data-attente]');
        this.unite = $('[data-unite]');
        this.matrice = $('[data-matrice]');
        this.trajets = $('[data-trajets]');
        this.note = $('[data-note]');
        this.ajoutTrajet = $('[data-ajout-trajet]');

        this.liste = new ListeReperes({ reglages: contexte.reglages, catalogue: contexte.catalogue, liste: 'dp-catalogue' });
        $('[data-liste]').append(this.liste.element);
        this.liste.addEventListener('change', () => this.oublier());
        this.liste.addEventListener('mode', () => this.c.plan.modeChoix(this.liste.ajoutParLePlan));

        this.groupe.addEventListener('change', () => this.changerGroupe());
        this.variante.addEventListener('change', () => {
            this.variantes[this.groupe.value] = this.variante.value;
            this.epingle = null;
            this.rendre();
        });
        this.unite.addEventListener('change', () => this.rendreTables());
        this.bouton.addEventListener('click', () => this.calculer());
        $('[data-copier-matrice]').addEventListener('click', e => boutonCopier(e.currentTarget, () => this.matriceWiki()));
        $('[data-copier-trajets]').addEventListener('click', e => boutonCopier(e.currentTarget, () => this.trajetsWiki()));
        $('[data-telecharger]').addEventListener('click', () => this.telecharger());
        this.ajoutTrajet.addEventListener('click', () => this.ajouterTrajet());
        for (const table of [this.matrice, this.trajets]) {
            table.addEventListener('pointerover', e => this.survoler(e.target.closest('[data-a]')));
            table.addEventListener('focusin', e => this.survoler(e.target.closest('[data-a]')));
            table.addEventListener('pointerleave', () => this.survoler(null));
            table.addEventListener('focusout', () => this.survoler(null));
            table.addEventListener('click', e => {
                const retirer = e.target.closest('[data-retirer-trajet]');
                if (retirer) {
                    this.c.reglages.config.trajets[this.groupe.value].splice(Number(retirer.dataset.retirerTrajet), 1);
                    this.rendreTables();
                    return;
                }
                this.epingler(e.target.closest('[data-a]'));
            });
            table.addEventListener('keydown', e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-a]')) {
                    e.preventDefault();
                    this.epingler(e.target);
                }
            });
        }
        this.changerGroupe();
    }

    get cle() {
        return `${this.groupe.value}|${this.variante.value}`;
    }

    get resultat() {
        return this.resultats.get(this.cle) ?? null;
    }

    activer() {
        this.c.plan.montrer('tableaux', true);
        this.c.plan.montrer('tableaux-survol', true);
        this.c.plan.modeChoix(this.liste.ajoutParLePlan);
        this.dessiner();
    }

    desactiver() {
        this.c.plan.montrer('tableaux', false);
        this.c.plan.montrer('tableaux-survol', false);
        this.c.plan.modeChoix(false);
    }

    choisir(clic) {
        if (this.liste.ajoutParLePlan) {
            this.liste.ajouter(this.c.catalogue.depuisPlan(clic, this.c.reglages.rayonPorte));
        }
    }

    changerGroupe() {
        this.liste.groupe = this.groupe.value;
        remplirVariantes(this.variante, this.variantes[this.groupe.value]);
        this.epingle = null;
        this.rendre();
    }

    // La liste du groupe a changé : ses résultats ne valent plus
    oublier() {
        for (const cle of [...this.resultats.keys()]) {
            if (cle.startsWith(`${this.groupe.value}|`)) {
                this.resultats.delete(cle);
            }
        }
        this.epingle = null;
        this.rendre();
    }

    terrainChange() {
        this.resultats.clear();
        this.epingle = null;
        this.rendre();
    }

    rafraichir() {
        this.rendre();
    }

    async calculer() {
        const groupe = this.groupe.value;
        const variante = this.variante.value;
        let geos;
        try {
            geos = this.liste.reperes.map(r => this.c.reperes.geometrie(r));
        } catch (e) {
            this.note.textContent = e.message;
            return;
        }
        this.bouton.disabled = true;
        this.attente.hidden = false;
        try {
            await this.c.pret;
            const r = await this.c.moteur.matrice(geos, variante, this.c.reglages.marge, this.c.statut.suivre('Distances'));
            this.resultats.set(`${groupe}|${variante}`, { ...r, geos, noms: geos.map(g => g.nom), reperes: structuredClone(this.liste.reperes) });
            this.c.statut.effacer();
        } catch (e) {
            this.c.statut.erreur(e.message);
        }
        this.bouton.disabled = false;
        this.attente.hidden = true;
        this.rendre();
    }

    rendre() {
        this.compte.textContent = `(${this.liste.reperes.length})`;
        this.bouton.textContent = this.resultat ? 'Recalculer' : 'Calculer les distances';
        this.zone.hidden = !this.resultat;
        this.remplirUnites();
        this.rendreTables();
        this.dessiner();
    }

    remplirUnites() {
        const choisie = this.unite.value || 'm';
        const unites = [['m', 'Mètres'], ['vol', "Mètres à vol d'oiseau"], ['detour', 'Détour (× vol d’oiseau)'],
            ...Object.keys(this.c.reglages.vitesses).map(a => [`min:${a}`, `Minutes, ${a.toLowerCase()}`])];
        this.unite.replaceChildren(...unites.map(([v, t]) => creer('option', { value: v, selected: v === choisie }, t)));
    }

    // La valeur d'une case de la matrice dans l'unité choisie
    valeur(a, b) {
        const r = this.resultat;
        const u = r.matrice[a][b];
        const vol = r.volDOiseau[a][b];
        const unite = this.unite.value || 'm';
        if (a === b) {
            return '×';
        }
        if (unite === 'vol') {
            return vol === null ? '-' : String(metres(vol, this.c.reglages));
        }
        if (u === null) {
            return '-';
        }
        if (unite === 'detour') {
            return texteNombre(u / Math.max(1, vol), 2);
        }
        if (unite.startsWith('min:')) {
            return texteNombre(minutes(u, this.c.reglages.vitesses[unite.slice(4)], this.c.reglages), 1);
        }
        return String(metres(u, this.c.reglages));
    }

    rendreTables() {
        const r = this.resultat;
        if (!r) {
            return;
        }
        const unite = this.unite.selectedOptions[0]?.textContent ?? 'Mètres';
        this.matrice.replaceChildren(
            creer('caption', {}, `${unite}, ${VARIANTES[this.variante.value].libelle.toLowerCase()}, de la ligne vers la colonne`),
            creer('thead', {}, creer('tr', {}, creer('td'), r.noms.map((n, b) => creer('th', { scope: 'col', 'data-colonne': b }, creer('span', {}, n))))),
            creer('tbody', {}, r.noms.map((n, a) => creer('tr', {},
                creer('th', { scope: 'row', 'data-ligne': a }, n),
                r.noms.map((_, b) => (a === b
                    ? creer('td', { class: 'diagonale' }, '×')
                    : creer('td', { tabindex: 0, 'data-a': a, 'data-b': b, title: `${n} → ${r.noms[b]}`, class: this.estEpingle(a, b) ? 'epingle' : null }, this.valeur(a, b))))))));
        const sans = r.noms.filter((_, i) => !r.departs[i]);
        this.note.textContent = sans.length ? `Sans accès dans cette variante : ${sans.join(', ')}.` : '';
        this.rendreTrajets();
        this.ajoutTrajet.hidden = !this.epingle;
    }

    // Les trajets choisis de la configuration (paires de noms), comme sur la page du wiki
    lignesTrajets() {
        const r = this.resultat;
        const { reglages } = this.c;
        const libelles = new Map(r.reperes.map(x => [x.nom, libelleDe(x)]));
        return (reglages.config.trajets?.[this.groupe.value] ?? []).map(([de, vers], i) => {
            const a = r.noms.indexOf(de);
            const b = r.noms.indexOf(vers);
            if (a < 0 || b < 0) {
                return { i, inconnu: a < 0 ? de : vers, cellules: [`${de} → ${vers}`] };
            }
            const u = r.matrice[a][b];
            return {
                i, a, b,
                cellules: [
                    `${libelles.get(de)} → ${libelles.get(vers)}`,
                    texteMetres(r.volDOiseau[a][b], reglages),
                    texteMetres(u, reglages),
                    ...Object.values(reglages.vitesses).map(kmh => texteDuree(u, kmh, reglages)),
                ],
            };
        });
    }

    entetesTrajets() {
        return ['Trajet', "Vol d'oiseau", this.groupe.value === 'en_ville' ? 'Par les rues' : 'Par les chemins', ...Object.keys(this.c.reglages.vitesses)];
    }

    rendreTrajets() {
        const lignes = this.lignesTrajets();
        this.trajets.replaceChildren(
            creer('thead', {}, creer('tr', {}, this.entetesTrajets().map(t => creer('th', { scope: 'col' }, t)), creer('td'))),
            creer('tbody', {}, lignes.length
                ? lignes.map(l => (l.inconnu
                    ? creer('tr', {}, creer('th', { scope: 'row' }, l.cellules[0]), creer('td', { colspan: this.entetesTrajets().length - 1, class: 'message--erreur' }, `Repère inconnu : ${l.inconnu}`), this.boutonRetirer(l.i))
                    : creer('tr', { tabindex: 0, 'data-a': l.a, 'data-b': l.b, class: this.estEpingle(l.a, l.b) ? 'epingle' : null },
                        creer('th', { scope: 'row' }, l.cellules[0]), l.cellules.slice(1).map(c => creer('td', {}, c)), this.boutonRetirer(l.i))))
                : creer('tr', {}, creer('td', { colspan: this.entetesTrajets().length + 1, class: 'message' }, 'Aucun trajet choisi : épinglez une case du tableau et ajoutez-la.'))));
    }

    boutonRetirer(i) {
        return creer('td', {}, creer('button', { type: 'button', class: 'bouton-icone bouton-icone--discret', 'data-retirer-trajet': i, 'aria-label': 'Retirer ce trajet', title: 'Retirer ce trajet' }, '×'));
    }

    matriceWiki() {
        const r = this.resultat;
        const suffixe = { m: `${INSECABLE}m`, vol: `${INSECABLE}m` }[this.unite.value] ?? '';
        return tableauWiki(['', ...r.noms], r.noms.map((n, a) => [n, ...r.noms.map((_, b) => {
            const v = this.valeur(a, b);
            return a === b || v === '-' ? v : v + suffixe;
        })]), { enTeteDeLigne: true });
    }

    trajetsWiki() {
        return tableauWiki(this.entetesTrajets(), this.lignesTrajets().filter(l => !l.inconnu).map(l => l.cellules));
    }

    telecharger() {
        const r = this.resultat;
        const donnees = {
            groupe: this.groupe.value,
            variante: this.variante.value,
            echelle: this.c.reglages.echelle,
            unite: 'unités du plan',
            noms: r.noms,
            departs: r.departs,
            matrice: r.matrice,
            vol_d_oiseau: r.volDOiseau,
        };
        telecharger(`distances-${this.groupe.value}-${this.variante.value}.json`, JSON.stringify(donnees, null, 4) + '\n');
    }

    // --- Le plan ----------------------------------------------------------------------------

    estEpingle(a, b) {
        return this.epingle?.[0] === a && this.epingle?.[1] === b;
    }

    epingler(el) {
        if (!el) {
            return;
        }
        const a = Number(el.dataset.a);
        const b = Number(el.dataset.b);
        this.epingle = this.estEpingle(a, b) ? null : [a, b];
        this.rendreTables();
        this.survoler(null);
    }

    ajouterTrajet() {
        const [a, b] = this.epingle;
        const trajets = (this.c.reglages.config.trajets ??= {});
        (trajets[this.groupe.value] ??= []).push([this.resultat.noms[a], this.resultat.noms[b]]);
        this.rendreTables();
    }

    // Le chemin d'une case survolée (ou, à défaut, de la case épinglée) en évidence
    survoler(el) {
        const r = this.resultat;
        const paire = el ? [Number(el.dataset.a), Number(el.dataset.b)] : this.epingle;
        this.matrice.querySelectorAll('.croise').forEach(x => x.classList.remove('croise'));
        if (!r || !paire) {
            this.c.plan.vider('tableaux-survol');
            return;
        }
        const [a, b] = paire;
        this.matrice.querySelector(`[data-ligne="${a}"]`)?.classList.add('croise');
        this.matrice.querySelector(`[data-colonne="${b}"]`)?.classList.add('croise');
        const chemin = r.chemins[a][b];
        this.c.plan.dessiner('tableaux-survol', contour(r.geos[a], 'contour--depart'), contour(r.geos[b], 'contour--arrivee'), chemin && trace(chemin, 'trace--trajet'));
        const n = chemin?.length ?? 0;
        this.c.plan.etiqueter('tableaux-survol', n ? [
            { x: chemin[n - 2], y: chemin[n - 1], texte: 'A', classe: 'etiquette--depart', titre: r.noms[a] },
            { x: chemin[0], y: chemin[1], texte: 'B', classe: 'etiquette--arrivee', titre: r.noms[b] },
        ] : []);
    }

    // Les repères du groupe et, une fois calculés, tous leurs chemins en léger
    dessiner() {
        const { plan, reperes } = this.c;
        const r = this.resultat;
        const geos = r?.geos ?? this.liste.reperes.flatMap(x => {
            try {
                return [reperes.geometrie(x)];
            } catch {
                return [];
            }
        });
        const chemins = [];
        if (r) {
            for (let a = 0; a < geos.length; a++) {
                for (let b = a + 1; b < geos.length; b++) {
                    if (r.chemins[a][b]) {
                        chemins.push(trace(r.chemins[a][b], 'trace--leger'));
                    }
                }
            }
        }
        plan.dessiner('tableaux', chemins, geos.map(g => contour(g, 'contour--repere')));
        plan.etiqueter('tableaux', geos.map(g => etiquette(g, g.nom, 'etiquette--repere')));
        this.survoler(null);
    }
}
