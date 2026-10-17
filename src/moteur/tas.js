// Tas binaire de cases (clé entière, priorité réelle), pour Dijkstra et A*.

export class Tas {
    constructor(capacite = 1 << 20) {
        this.cles = new Int32Array(capacite);
        this.valeurs = new Float64Array(capacite);
        this.n = 0;
    }

    vider() {
        this.n = 0;
    }

    ajouter(cle, valeur) {
        if (this.n === this.cles.length) {
            const cles = new Int32Array(this.n * 2);
            const valeurs = new Float64Array(this.n * 2);
            cles.set(this.cles);
            valeurs.set(this.valeurs);
            this.cles = cles;
            this.valeurs = valeurs;
        }
        let i = this.n++;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.valeurs[p] <= valeur) {
                break;
            }
            this.cles[i] = this.cles[p];
            this.valeurs[i] = this.valeurs[p];
            i = p;
        }
        this.cles[i] = cle;
        this.valeurs[i] = valeur;
    }

    // Retire la plus petite ; sa clé et sa valeur restent dans this.cle et this.valeur
    retirer() {
        this.cle = this.cles[0];
        this.valeur = this.valeurs[0];
        const dk = this.cles[--this.n];
        const dv = this.valeurs[this.n];
        let i = 0;
        for (;;) {
            let c = 2 * i + 1;
            if (c >= this.n) {
                break;
            }
            if (c + 1 < this.n && this.valeurs[c + 1] < this.valeurs[c]) {
                c++;
            }
            if (this.valeurs[c] >= dv) {
                break;
            }
            this.cles[i] = this.cles[c];
            this.valeurs[i] = this.valeurs[c];
            i = c;
        }
        this.cles[i] = dk;
        this.valeurs[i] = dv;
    }
}
