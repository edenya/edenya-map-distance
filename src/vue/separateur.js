// La barre entre le plan et le panneau : la glisser (ou les flèches) change la largeur du
// panneau, retenue d'une visite à l'autre.

const MEMOIRE = 'distances-plan.panneau';
const PROPRIETE = '--largeur-panneau';

export class Separateur {
    constructor(barre) {
        this.barre = barre;
        try {
            const largeur = Number(localStorage.getItem(MEMOIRE));
            if (largeur) {
                this.largeur(largeur);
            }
        } catch {
            // stockage indisponible : la largeur par défaut
        }
        barre.addEventListener('pointerdown', e => {
            barre.setPointerCapture(e.pointerId);
            this.glisse = true;
            document.body.classList.add('redimensionne');
        });
        barre.addEventListener('pointermove', e => {
            if (this.glisse) {
                this.largeur(window.innerWidth - e.clientX);
            }
        });
        barre.addEventListener('pointerup', () => this.lacher());
        barre.addEventListener('pointercancel', () => this.lacher());
        barre.addEventListener('keydown', e => {
            const pas = { ArrowLeft: 24, ArrowRight: -24 }[e.key];
            if (pas) {
                e.preventDefault();
                this.largeur(this.actuelle + pas);
                this.retenir();
            }
        });
    }

    get actuelle() {
        return this.barre.nextElementSibling.getBoundingClientRect().width;
    }

    largeur(px) {
        const l = Math.round(Math.min(Math.max(300, px), Math.max(300, Math.min(960, window.innerWidth - 320))));
        document.documentElement.style.setProperty(PROPRIETE, `${l}px`);
        this.barre.setAttribute('aria-valuenow', String(l));
    }

    lacher() {
        if (!this.glisse) {
            return;
        }
        this.glisse = false;
        document.body.classList.remove('redimensionne');
        this.retenir();
    }

    retenir() {
        try {
            localStorage.setItem(MEMOIRE, String(Math.round(this.actuelle)));
        } catch {
            // rien à retenir
        }
    }
}
