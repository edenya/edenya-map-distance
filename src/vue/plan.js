// La vue du plan : le dessin de la ville, qu'on déplace (glisser, flèches) et qu'on zoome
// (molette, pincement, boutons, + et -), et par-dessus, en unités du plan, les formes
// cliquables (bâtiments, lieux), le calque de contrôle et un calque par onglet (chemins,
// repères, zones). Un clic sans glisser émet « choix » : { x, y, forme }, forme valant
// { batiment } ou { lieu } (les objets de l'export), ou null.
//
// Pendant un geste, la scène suit par une transformation CSS (fluide) ; au repos, la vue est
// redessinée nette dans le viewBox du SVG.

import { creer, creerSvg, formeSvg } from './dom.js';
import { texteNombre } from './format.js';

const ZOOM_MAX = 12; // pixels par unité du plan
const REPOS = 150; // ms sans molette avant de redessiner net

// Les couleurs du calque de contrôle, par classe de case (RVBA)
export const PALETTE = {
    infranchissable: [45, 35, 25, 150],
    dehors: [0, 0, 0, 0],
    interieur: [40, 110, 200, 80],
    rue: [20, 150, 70, 110],
};
const LEGENDE = [
    ['rue', 'Rues, places, ponts et routes'],
    ['interieur', 'Dans les murs, hors des rues'],
    ['dehors', 'Hors les murs, à travers champs'],
    ['infranchissable', 'Infranchissable'],
];

export class Plan extends EventTarget {
    constructor(conteneur, ville, catalogue) {
        super();
        this.conteneur = conteneur;
        this.largeur = ville.largeur;
        this.hauteur = ville.hauteur;
        this.vue = { x: 0, y: 0, s: 1 };
        this.affichee = { ...this.vue };
        this.couches = new Map();
        this.pointeurs = new Map();
        this.geste = null;
        this.batiments = new Map(ville.lieux.batiments.map(b => [`${b.secteur}-${b.numero}`, b]));
        this.lieux = ville.lieux.lieux;
        this.construire(ville, catalogue);
        this.ecouter();
        new ResizeObserver(() => this.redimensionner()).observe(conteneur);
    }

    construire(ville, catalogue) {
        const dessin = creerSvg('g', { class: 'plan__dessin' });
        for (const enfant of ville.dessin.documentElement.children) {
            if (enfant.localName !== 'title') {
                dessin.append(document.importNode(enfant, true));
            }
        }
        this.controle = creerSvg('image', { class: 'plan__controle', width: this.largeur, height: this.hauteur, preserveAspectRatio: 'none' });
        this.formes = creerSvg('g', { class: 'plan__formes' });
        for (const [cle, b] of this.batiments) {
            // les abords de la ville sont de grandes zones, pas des bâtiments
            if (b.secteur !== 'EX') {
                const forme = formeSvg(b, { class: 'plan__forme', 'data-batiment': cle });
                forme.append(creerSvg('title', {}, catalogue.titreBatiment(b)));
                this.formes.append(forme);
            }
        }
        this.lieux.forEach((l, i) => {
            const forme = formeSvg(l, { class: 'plan__forme plan__forme--lieu', 'data-lieu': i });
            forme.append(creerSvg('title', {}, l.titre));
            this.formes.append(forme);
        });
        this.surcouches = creerSvg('g', { class: 'plan__surcouches' });
        this.svg = creerSvg('svg', { class: 'plan__svg', 'aria-hidden': 'true' }, dessin, this.controle, this.formes, this.surcouches);
        this.etiquettes = creer('div', { class: 'plan__etiquettes' });
        this.scene = creer('div', { class: 'plan__scene' }, this.svg, this.etiquettes);
        this.position = creer('div', { class: 'plan__position', hidden: true });
        this.legende = creer('ul', { class: 'plan__legende', hidden: true },
            LEGENDE.map(([classe, texte]) => creer('li', {}, creer('span', { class: 'plan__pastille', style: `--couleur: rgb(${PALETTE[classe].slice(0, 3).join(' ')} / ${(PALETTE[classe][3] / 255).toFixed(2)})` }), texte)));
        const bouton = (zoom, texte, titre) => creer('button', { type: 'button', class: 'bouton-icone', 'data-zoom': zoom, title: titre, 'aria-label': titre }, texte);
        this.caseControle = creer('input', { type: 'checkbox' });
        const outils = creer('div', { class: 'plan__outils' },
            bouton('plus', '+', 'Se rapprocher'),
            bouton('moins', '−', "S'éloigner"),
            bouton('ensemble', '⤢', 'Toute la ville'),
            creer('label', { class: 'case plan__bascule', title: 'Où le calcul peut passer' }, this.caseControle, 'Calque de contrôle'));
        this.conteneur.append(this.scene, outils, this.legende, this.position);
    }

    ecouter() {
        this.svg.addEventListener('pointerdown', e => this.appuyer(e));
        this.svg.addEventListener('pointermove', e => this.bouger(e));
        this.svg.addEventListener('pointerup', e => this.relacher(e, false));
        this.svg.addEventListener('pointercancel', e => this.relacher(e, true));
        this.svg.addEventListener('pointerleave', () => (this.position.hidden = true));
        this.svg.addEventListener('wheel', e => this.molette(e), { passive: false });
        this.conteneur.addEventListener('keydown', e => this.touche(e));
        this.conteneur.querySelector('.plan__outils').addEventListener('click', e => {
            const zoom = e.target.closest('[data-zoom]')?.dataset.zoom;
            if (zoom === 'ensemble') {
                this.ensemble();
            } else if (zoom) {
                this.zoomer(zoom === 'plus' ? 1.6 : 1 / 1.6);
                this.valider();
            }
        });
        this.caseControle.addEventListener('change', () => this.montrerControle(this.caseControle.checked));
    }

    // --- La vue -----------------------------------------------------------------------------

    get taille() {
        return { l: this.conteneur.clientWidth || 1, h: this.conteneur.clientHeight || 1 };
    }

    get zoomMin() {
        const { l, h } = this.taille;
        return Math.min(l / this.largeur, h / this.hauteur) * 0.5;
    }

    // Un point de l'écran (clientX, clientY) en unités du plan
    versPlan(cx, cy) {
        const r = this.conteneur.getBoundingClientRect();
        return [this.vue.x + (cx - r.left) / this.vue.s, this.vue.y + (cy - r.top) / this.vue.s];
    }

    // Change la vue voulue ; la scène la suit à la prochaine image
    voir({ x, y, s }) {
        const { l, h } = this.taille;
        s = Math.min(ZOOM_MAX, Math.max(this.zoomMin, s));
        // le milieu de l'écran reste sur le plan
        x = Math.min(this.largeur - l / (2 * s), Math.max(-l / (2 * s), x));
        y = Math.min(this.hauteur - h / (2 * s), Math.max(-h / (2 * s), y));
        this.vue = { x, y, s };
        if (!this.image) {
            this.image = requestAnimationFrame(() => {
                this.image = null;
                const a = this.affichee;
                const v = this.vue;
                this.scene.style.transform = `translate(${(a.x - v.x) * v.s}px, ${(a.y - v.y) * v.s}px) scale(${v.s / a.s})`;
            });
        }
        this.conteneur.classList.add('plan--geste');
    }

    // Redessine net : le viewBox prend la vue voulue, les étiquettes se replacent
    valider() {
        clearTimeout(this.repos);
        cancelAnimationFrame(this.image);
        this.image = null;
        const { l, h } = this.taille;
        const v = this.vue;
        this.affichee = { ...v };
        this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${l / v.s} ${h / v.s}`);
        this.scene.style.transform = '';
        this.conteneur.classList.remove('plan--geste');
        for (const couche of this.couches.values()) {
            this.placer(couche.etiquettes);
        }
    }

    // Zoome d'un facteur autour d'un point de l'écran (le milieu par défaut)
    zoomer(facteur, cx = null, cy = null) {
        const r = this.conteneur.getBoundingClientRect();
        cx ??= r.left + r.width / 2;
        cy ??= r.top + r.height / 2;
        const [px, py] = this.versPlan(cx, cy);
        const s = Math.min(ZOOM_MAX, Math.max(this.zoomMin, this.vue.s * facteur));
        this.voir({ x: px - (cx - r.left) / s, y: py - (cy - r.top) / s, s });
    }

    // Montre une boîte du plan [x0, y0, x1, y1], avec une marge en pixels
    cadrer([x0, y0, x1, y1], marge = 48) {
        const { l, h } = this.taille;
        const s = Math.min(ZOOM_MAX, (l - 2 * marge) / Math.max(1, x1 - x0), (h - 2 * marge) / Math.max(1, y1 - y0));
        this.voir({ x: (x0 + x1) / 2 - l / (2 * s), y: (y0 + y1) / 2 - h / (2 * s), s });
        this.valider();
    }

    ensemble() {
        this.cadrer([0, 0, this.largeur, this.hauteur], 0);
    }

    // Montre une boîte si elle n'est pas déjà tout entière à l'écran
    montrerBoite(b, marge = 48) {
        const { l, h } = this.taille;
        const { x, y, s } = this.vue;
        const m = marge / s;
        if (b[0] < x + m || b[1] < y + m || b[2] > x + l / s - m || b[3] > y + h / s - m) {
            this.cadrer(b, marge);
        }
    }

    redimensionner() {
        const { l, h } = this.taille;
        if (!this.dimensions) {
            this.dimensions = { l, h };
            this.ensemble();
            return;
        }
        // le milieu de la vue ne bouge pas
        const v = this.vue;
        const cx = v.x + this.dimensions.l / (2 * v.s);
        const cy = v.y + this.dimensions.h / (2 * v.s);
        this.dimensions = { l, h };
        this.voir({ x: cx - l / (2 * v.s), y: cy - h / (2 * v.s), s: v.s });
        this.valider();
    }

    // --- Les gestes -------------------------------------------------------------------------

    appuyer(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) {
            return;
        }
        this.svg.setPointerCapture(e.pointerId);
        this.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointeurs.size === 1) {
            this.geste = { x: e.clientX, y: e.clientY, vue: { ...this.vue }, cible: e.target, bouge: false };
        } else if (this.pointeurs.size === 2) {
            this.geste = this.pincement();
        }
    }

    pincement() {
        const [a, b] = [...this.pointeurs.values()];
        return { pince: true, bouge: true, vue: { ...this.vue }, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    bouger(e) {
        if (!this.geste) {
            const [x, y] = this.versPlan(e.clientX, e.clientY);
            this.position.hidden = false;
            this.position.textContent = `x ${texteNombre(Math.round(x))} · y ${texteNombre(Math.round(y))}`;
        }
        if (!this.pointeurs.has(e.pointerId) || !this.geste) {
            return;
        }
        this.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = this.geste;
        const r = this.conteneur.getBoundingClientRect();
        if (g.pince && this.pointeurs.size >= 2) {
            const [a, b] = [...this.pointeurs.values()];
            const s = Math.min(ZOOM_MAX, Math.max(this.zoomMin, g.vue.s * Math.hypot(a.x - b.x, a.y - b.y) / g.d));
            // le point du plan sous le milieu des doigts suit le milieu des doigts
            const px = g.vue.x + (g.x - r.left) / g.vue.s;
            const py = g.vue.y + (g.y - r.top) / g.vue.s;
            this.voir({ x: px - ((a.x + b.x) / 2 - r.left) / s, y: py - ((a.y + b.y) / 2 - r.top) / s, s });
            return;
        }
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (!g.bouge && Math.hypot(dx, dy) < 5) {
            return;
        }
        g.bouge = true;
        this.conteneur.classList.add('plan--glisse');
        this.voir({ x: g.vue.x - dx / g.vue.s, y: g.vue.y - dy / g.vue.s, s: g.vue.s });
    }

    relacher(e, annule) {
        if (!this.pointeurs.delete(e.pointerId) || !this.geste) {
            return;
        }
        if (this.pointeurs.size === 1) {
            // reste un doigt : il continue à déplacer, sans clic à la fin
            const [p] = this.pointeurs.values();
            this.geste = { x: p.x, y: p.y, vue: { ...this.vue }, bouge: true };
            return;
        }
        if (this.pointeurs.size === 0) {
            if (!this.geste.bouge && !annule) {
                this.cliquer(e, this.geste.cible);
            }
            this.geste = null;
            this.conteneur.classList.remove('plan--glisse');
            this.valider();
        }
    }

    molette(e) {
        e.preventDefault();
        const pas = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0015;
        this.zoomer(Math.exp(-e.deltaY * pas), e.clientX, e.clientY);
        clearTimeout(this.repos);
        this.repos = setTimeout(() => this.valider(), REPOS);
    }

    touche(e) {
        const pas = 80 / this.vue.s;
        const deplacements = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
        if (deplacements[e.key]) {
            const [dx, dy] = deplacements[e.key];
            this.voir({ ...this.vue, x: this.vue.x + dx, y: this.vue.y + dy });
        } else if (e.key === '+' || e.key === '=') {
            this.zoomer(1.6);
        } else if (e.key === '-') {
            this.zoomer(1 / 1.6);
        } else if (e.key === '0') {
            this.ensemble();
            e.preventDefault();
            return;
        } else {
            return;
        }
        e.preventDefault();
        this.valider();
    }

    cliquer(e, cible) {
        const [x, y] = this.versPlan(e.clientX, e.clientY);
        const el = cible?.closest?.('[data-batiment], [data-lieu]');
        let forme = null;
        if (el?.dataset.batiment) {
            forme = { batiment: this.batiments.get(el.dataset.batiment) };
        } else if (el?.dataset.lieu) {
            forme = { lieu: this.lieux[Number(el.dataset.lieu)] };
        }
        this.dispatchEvent(new CustomEvent('choix', { detail: { x, y, forme } }));
    }

    // Le curseur en croix : un clic sur le plan choisit quelque chose
    modeChoix(actif) {
        this.conteneur.classList.toggle('plan--choix', actif);
    }

    // --- Les calques ------------------------------------------------------------------------

    couche(nom) {
        if (!this.couches.has(nom)) {
            const couche = { g: creerSvg('g', { 'data-calque': nom }), etiquettes: creer('div', { 'data-calque': nom }) };
            this.surcouches.append(couche.g);
            this.etiquettes.append(couche.etiquettes);
            this.couches.set(nom, couche);
        }
        return this.couches.get(nom);
    }

    // Remplace le contenu SVG d'un calque
    dessiner(nom, ...elements) {
        this.couche(nom).g.replaceChildren(...elements.flat().filter(Boolean));
    }

    // Remplace les étiquettes d'un calque : [{ x, y, texte, classe, titre }]
    etiqueter(nom, liste) {
        const couche = this.couche(nom).etiquettes;
        couche.replaceChildren(...liste.map(e => {
            const el = creer('div', { class: `etiquette ${e.classe ?? ''}`, title: e.titre }, creer('span', { class: 'etiquette__texte' }, e.texte));
            el.position = [e.x, e.y];
            return el;
        }));
        this.placer(couche);
    }

    placer(couche) {
        const v = this.affichee;
        for (const el of couche.children) {
            el.style.transform = `translate(${(el.position[0] - v.x) * v.s}px, ${(el.position[1] - v.y) * v.s}px)`;
        }
    }

    montrer(nom, visible) {
        const couche = this.couche(nom);
        couche.g.style.display = visible ? '' : 'none';
        couche.etiquettes.hidden = !visible;
    }

    vider(nom) {
        this.dessiner(nom);
        this.etiqueter(nom, []);
    }

    // Le calque de contrôle : une image PNG de la grille (Blob)
    definirControle(image) {
        if (this.urlControle) {
            URL.revokeObjectURL(this.urlControle);
        }
        this.urlControle = URL.createObjectURL(image);
        this.controle.setAttribute('href', this.urlControle);
    }

    montrerControle(visible) {
        this.caseControle.checked = visible;
        this.conteneur.classList.toggle('plan--controle', visible);
        this.legende.hidden = !visible;
    }
}
