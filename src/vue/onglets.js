// Les onglets du panneau. Chaque onglet a un panneau (objet) qui peut répondre à activer(),
// desactiver() et choisir(clic) (un clic sur le plan). Le dernier onglet ouvert est retenu.

const MEMOIRE = 'distances-plan.onglet';

export class Onglets {
    constructor(liste, panneaux) {
        this.boutons = [...liste.querySelectorAll('[role="tab"]')];
        this.panneaux = panneaux;
        this.actif = null;
        liste.addEventListener('click', e => {
            const bouton = e.target.closest('[role="tab"]');
            if (bouton) {
                this.ouvrir(bouton.dataset.onglet);
            }
        });
        liste.addEventListener('keydown', e => this.touche(e));
        // au départ, seul l'onglet ouvert montre ses calques
        for (const panneau of Object.values(panneaux)) {
            panneau.desactiver?.();
        }
        let premier = this.boutons[0].dataset.onglet;
        try {
            premier = localStorage.getItem(MEMOIRE) ?? premier;
        } catch {
            // stockage indisponible : le premier onglet
        }
        this.ouvrir(this.panneaux[premier] ? premier : this.boutons[0].dataset.onglet);
    }

    ouvrir(nom) {
        if (this.actif === nom) {
            return;
        }
        if (this.actif) {
            this.panneaux[this.actif].desactiver?.();
        }
        this.actif = nom;
        for (const bouton of this.boutons) {
            const choisi = bouton.dataset.onglet === nom;
            bouton.setAttribute('aria-selected', String(choisi));
            bouton.tabIndex = choisi ? 0 : -1;
            document.getElementById(bouton.getAttribute('aria-controls')).hidden = !choisi;
        }
        this.panneaux[nom].activer?.();
        try {
            localStorage.setItem(MEMOIRE, nom);
        } catch {
            // rien à retenir
        }
    }

    get panneau() {
        return this.panneaux[this.actif];
    }

    touche(e) {
        const i = this.boutons.findIndex(b => b.dataset.onglet === this.actif);
        const suivant = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: this.boutons.length - 1 }[e.key];
        if (suivant === undefined) {
            return;
        }
        e.preventDefault();
        const bouton = this.boutons[(suivant + this.boutons.length) % this.boutons.length];
        this.ouvrir(bouton.dataset.onglet);
        bouton.focus();
    }
}
