// Sortir les résultats de la page : un tableau du wiki (syntaxe DokuWiki), le presse-papiers,
// un fichier à télécharger.

// Un tableau DokuWiki. lignes : [[cellule…]…] ; la première cellule de chaque ligne est un
// en-tête quand enTeteDeLigne ; les autres cellules sont alignées à droite (deux espaces devant).
export function tableauWiki(entetes, lignes, { enTeteDeLigne = false } = {}) {
    const texte = [`^ ${entetes.join(' ^ ')} ^`];
    for (const [premiere, ...autres] of lignes) {
        texte.push(`${enTeteDeLigne ? '^' : '|'} ${premiere} |  ${autres.join(' |  ')} |`);
    }
    return texte.join('\n');
}

export async function copier(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        return true;
    } catch {
        // sans accès au presse-papiers (page hors https, permission refusée) : la vieille méthode
        const zone = document.createElement('textarea');
        zone.value = texte;
        zone.setAttribute('readonly', '');
        zone.className = 'hors-ecran';
        document.body.append(zone);
        zone.select();
        const ok = document.execCommand('copy');
        zone.remove();
        return ok;
    }
}

export function telecharger(nom, texte, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([texte], { type: `${type};charset=utf-8` }));
    const lien = Object.assign(document.createElement('a'), { href: url, download: nom });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Un bouton qui copie : son libellé dit un instant si c'est fait
export function boutonCopier(bouton, texte) {
    const libelle = bouton.dataset.libelle ?? bouton.textContent;
    bouton.dataset.libelle = libelle;
    copier(texte()).then(ok => {
        bouton.textContent = ok ? 'Copié' : 'Copie impossible';
        setTimeout(() => (bouton.textContent = libelle), 1500);
    });
}
