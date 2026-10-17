// La géométrie d'un repère, partagée par la page et le moteur, en unités du plan :
// { point: [x, y] } | { poly: [[x, y]…] } | { cercle: [cx, cy, r] }.

// Son centre : le point, le centre du cercle, la moyenne des sommets du polygone
export function centre(geo) {
    if (geo.cercle) {
        return [geo.cercle[0], geo.cercle[1]];
    }
    if (geo.point) {
        return geo.point;
    }
    let sx = 0;
    let sy = 0;
    for (const [x, y] of geo.poly) {
        sx += x;
        sy += y;
    }
    return [sx / geo.poly.length, sy / geo.poly.length];
}

// Sa boîte : [x0, y0, x1, y1]
export function boite(geo) {
    if (geo.cercle) {
        const [x, y, r] = geo.cercle;
        return [x - r, y - r, x + r, y + r];
    }
    const sommets = geo.poly ?? [geo.point];
    return [
        Math.min(...sommets.map(p => p[0])),
        Math.min(...sommets.map(p => p[1])),
        Math.max(...sommets.map(p => p[0])),
        Math.max(...sommets.map(p => p[1])),
    ];
}

// La boîte qui contient toutes les autres
export function reunion(boites) {
    return boites.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
}
