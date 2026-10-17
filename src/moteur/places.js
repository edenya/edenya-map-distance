// La taille des places : l'espace libre qui reste quand on en retire tout passage plus étroit
// que deux fois un rayon (une place y survit, une rue non), puis la zone d'un seul tenant
// autour d'un point.

// Ouverture morphologique d'un masque par un disque de rayon r
export function ouverture(grille, m, r) {
    const { largeur: W, hauteur: H, taille } = grille;
    // distance de chaque case libre à la plus proche case non libre (chanfrein 1, √2)
    const d = new Float64Array(taille);
    for (let i = 0; i < taille; i++) {
        d[i] = m[i] ? 1e9 : 0;
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const k = y * W + x;
            if (!d[k]) {
                continue;
            }
            let v = d[k];
            if (x > 0) v = Math.min(v, d[k - 1] + 1);
            if (y > 0) v = Math.min(v, d[k - W] + 1);
            if (x > 0 && y > 0) v = Math.min(v, d[k - W - 1] + Math.SQRT2);
            if (x < W - 1 && y > 0) v = Math.min(v, d[k - W + 1] + Math.SQRT2);
            d[k] = v;
        }
    }
    for (let y = H - 1; y >= 0; y--) {
        for (let x = W - 1; x >= 0; x--) {
            const k = y * W + x;
            if (!d[k]) {
                continue;
            }
            let v = d[k];
            if (x < W - 1) v = Math.min(v, d[k + 1] + 1);
            if (y < H - 1) v = Math.min(v, d[k + W] + 1);
            if (x < W - 1 && y < H - 1) v = Math.min(v, d[k + W + 1] + Math.SQRT2);
            if (x > 0 && y < H - 1) v = Math.min(v, d[k + W - 1] + Math.SQRT2);
            d[k] = v;
        }
    }
    // chaque centre assez loin des bords rend libre son disque
    const o = new Uint8Array(taille);
    for (let k = 0; k < taille; k++) {
        if (d[k] < r) {
            continue;
        }
        const x = k % W;
        const y = (k - x) / W;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r || !grille.dedans(x + dx, y + dy)) {
                    continue;
                }
                const nk = (y + dy) * W + x + dx;
                if (m[nk]) {
                    o[nk] = 1;
                }
            }
        }
    }
    return o;
}

// La zone d'un seul tenant qui contient une case : son aire, sa boîte [x, y, largeur, hauteur],
// les côtés du rectangle de mêmes moments, et son masque dans la boîte. null hors du masque.
export function zone(grille, m, depart) {
    if (depart < 0 || !m[depart]) {
        return null;
    }
    const W = grille.largeur;
    const vu = grille.remplir(m, depart);
    let n = 0;
    let x0 = Infinity;
    let x1 = -1;
    let y0 = Infinity;
    let y1 = -1;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (let k = 0; k < vu.length; k++) {
        if (!vu[k]) {
            continue;
        }
        const x = k % W;
        const y = (k - x) / W;
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        sx += x;
        sy += y;
        sxx += x * x;
        syy += y * y;
        sxy += x * y;
    }
    const mx = sx / n;
    const my = sy / n;
    const cxx = sxx / n - mx * mx;
    const cyy = syy / n - my * my;
    const cxy = sxy / n - mx * my;
    const t = (cxx + cyy) / 2;
    const e = Math.sqrt(Math.max(0, t * t - (cxx * cyy - cxy * cxy)));
    const boite = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
    const masque = new Uint8Array(boite[2] * boite[3]);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            masque[(y - y0) * boite[2] + x - x0] = vu[y * W + x];
        }
    }
    return {
        aire: n,
        boite,
        rectangle: [Math.sqrt(12 * (t + e)), Math.sqrt(12 * (t - e))].map(v => Math.round(v)),
        masque,
    };
}
