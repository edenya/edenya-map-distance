// La ligne d'état de l'en-tête : ce que fait le moteur, sa progression, une erreur.

export class Statut {
    constructor(element) {
        this.element = element;
        this.texte = element.querySelector('[data-statut-texte]');
        this.barre = element.querySelector('progress');
    }

    // part : de 0 à 1, ou null quand on ne sait pas
    afficher(texte, part = null) {
        this.element.hidden = false;
        this.element.classList.remove('statut--erreur');
        this.texte.textContent = texte;
        this.barre.hidden = false;
        if (part === null) {
            this.barre.removeAttribute('value');
        } else {
            this.barre.value = part;
        }
    }

    erreur(texte) {
        this.element.hidden = false;
        this.element.classList.add('statut--erreur');
        this.texte.textContent = texte;
        this.barre.hidden = true;
    }

    effacer() {
        this.element.hidden = true;
    }

    // Suit une demande au moteur : « Calcul : Tour Blanche (3/11) »
    suivre(titre) {
        return (fait, total, texte) => this.afficher(`${titre} : ${texte} (${fait + 1}/${total})`, total ? fait / total : null);
    }
}
