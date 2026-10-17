# Distances sur le plan

Les distances et les temps de trajet à pied sur le plan vectoriel d'une ville d'Edenya (Vahal pour
l'instant) : par le plus court chemin, par les rues, les places et les ponts, sans jamais traverser
une maison ni une muraille, sauf par ses portes. C'est ce calcul qui donne la page « La ville et les
distances » du wiki d'Edenya (17 octobre 2026), à l'échelle retenue pour Vahal : **une unité du plan
vaut 0,5 m**, une case de la grille du plan 125 m.

Le projet a deux entrées, qui partagent le même moteur :

- **l'application web** : le plan, les repères, les trajets dessinés, les tableaux de distances, la
  taille des places, les réglages, et l'export des tableaux pour le wiki ;
- **l'outil en ligne de commande** (`npm run mesurer`) : les mêmes calculs dans le terminal, et les
  tableaux DokuWiki de la page du wiki.

Les données d'une ville (son dessin, ses lieux, ses bâtiments) sont exportées du jeu une fois pour
toutes (`npm run exporter`) et rangées dans `public/villes/` : ni l'application ni l'outil n'ont
besoin du jeu pour tourner.

## Prérequis

- Node.js 22 ou plus, et npm ;
- ou Docker (avec Docker Compose), pour servir l'application sans rien installer d'autre.

## Lancer l'application

Avec npm :

```bash
npm install
npm run dev          # serveur de développement : http://localhost:5173
```

La version construite (ce que l'on mettrait sur un serveur) :

```bash
npm run build        # écrit dist/
npm run preview      # la sert : http://localhost:4173
```

`dist/` est un site statique : n'importe quel serveur web le sert, dans n'importe quel dossier.

Avec Docker :

```bash
docker compose up -d --build              # l'application construite : http://localhost:8090
docker compose --profile dev up           # le serveur de développement : http://localhost:5173
docker compose down                       # arrête tout
```

Le port de l'application construite se change par la variable `PORT` (`PORT=9000 docker compose up -d`).

`?ville=vahal` dans l'adresse choisit une ville de `public/villes/villes.json` (la première par
défaut). Navigateurs : Chrome, Edge, Firefox 114 et plus, Safari 16.4 et plus (Web Worker en module
et `OffscreenCanvas`).

## Utiliser l'application

- **Trajet** : un clic sur le plan pour le départ, un clic pour l'arrivée (un nouveau clic la
  déplace), ou un choix dans la liste. La page trace le chemin et donne la distance arrondie comme
  sur le wiki, le vol d'oiseau et le détour, la durée à chaque allure (`vitesses`), la longueur
  exacte, et la ligne à coller dans le tableau du wiki. Trois façons de marcher : par les rues (dans
  les murs), dans les murs avec les parcs et jardins, partout à travers champs (la muraille
  seulement aux portes).
- **Tableaux** : les distances entre tous les repères d'un groupe (`en_ville`, `hors_les_murs`), en
  mètres, à vol d'oiseau, en détour ou en minutes ; survoler une case montre son chemin, un clic
  l'épingle et peut l'ajouter aux trajets choisis. Les trajets choisis (`trajets`) sont ceux de la
  page du wiki ; « Copier pour le wiki » donne le tableau en syntaxe DokuWiki.
- **Places** : la taille de chaque place (`places`), peinte sur le plan.
- **Réglages** : l'échelle, l'arrondi, les allures, l'ouverture des portes, la marge autour des
  bâtiments, le rayon des places. Ce qu'on change dans la page (réglages, repères, places, trajets)
  n'y vit que le temps de la visite : « Télécharger la configuration » rend le fichier qui remplace
  `public/villes/<ville>/configuration.json`.
- Le **calque de contrôle** (case en haut du plan) montre où le calcul peut passer.

Glisser déplace le plan, la molette ou deux doigts zooment ; au clavier, flèches, `+`, `-`, et `0`
pour toute la ville. Le coin bas droit donne la position du pointeur en unités du plan (pour écrire
un `point` dans la configuration). La barre entre le plan et le panneau règle sa largeur.

## L'outil en ligne de commande

```bash
npm run mesurer                                        # Vahal, rapport dans le terminal
npm run mesurer -- --wiki                              # + les tableaux de trajets pour le wiki
npm run mesurer -- --image sorties/controle.png        # + l'image de contrôle
npm run mesurer -- --json sorties/resultats.json       # + les valeurs brutes, en unités du plan
npm run mesurer -- --ville vahal                       # une autre ville exportée
```

Le calcul prend une vingtaine de secondes. Il écrit :

- les distances **en ville** entre les repères de `en_ville`, deux fois : par les rues, les places et
  les ponts seulement, puis en comptant aussi les parcs et les jardins ouverts sur la rue ; puis les
  mêmes en minutes, à la première allure de `vitesses` ;
- les distances **hors les murs** entre les repères de `hors_les_murs`, à travers champs, la muraille
  ne se franchissant qu'aux portes ;
- les **trajets** choisis dans `trajets` : à vol d'oiseau, par les rues (par les chemins hors les
  murs), et le temps à chaque allure. Avec `--wiki`, les mêmes en tableaux DokuWiki, prêts à coller
  dans la page `distances` du wiki (espaces insécables comprises) ;
- la taille des **places** de `places` : l'espace libre qui reste quand on retire tout passage plus
  étroit que deux fois `rayon_places` (une place y survit, une rue non), son aire et les côtés du
  rectangle qui lui ressemble le plus.

L'image de contrôle montre les rues en clair, l'intérieur des murs en gris clair, les chemins trouvés
en vert et les repères en rouge : à regarder après tout changement de la configuration. Les
distances sont arrondies à `arrondi` mètres (à 5 m sous 100 m).

## Les données d'une ville

`public/villes/villes.json` liste les villes exportées ; chacune a son dossier :

| Fichier | Contenu |
|---------|---------|
| `public/villes/villes.json` | pour chaque ville : son titre et les chemins de ses trois fichiers |
| `public/villes/vahal/configuration.json` | la configuration du calcul (ci-dessous), écrite à la main |
| `public/villes/vahal/plan.svg` | le dessin du plan, copie de `_game/vahal/images/carte/vahal.svg` du jeu |
| `public/villes/vahal/lieux.json` | les quartiers, les lieux sans bâtiment et les contours des bâtiments, en unités du plan |

`npm run exporter` refait le dessin et les lieux depuis le jeu. Il lit un dépôt d'Edenya et sa base
Docker, qui doit tourner (`docker compose up -d` dans le dépôt du jeu) :

```bash
npm run exporter -- --edenya ../chemin/vers/edenya --ville vahal
```

Les vues des quartiers et les lieux sans bâtiment viennent de `Carte::$plans`
(`_engine/src/Lieu/Carte.php`), les bâtiments et les noms des quartiers de la base (tables
`batiment`, `secteur`, `commerce`, `guilde`) ; les coordonnées sont reportées sur le plan comme le
fait `Carte::points()`. Pour une nouvelle ville, écrire d'abord sa `configuration.json` (en partant de
celle de Vahal), puis l'exporter.

## La configuration

| Clé | Rôle |
|-----|------|
| `ville` | l'identifiant de la ville dans le jeu (`"1"` pour Vahal : `Ville::VAHAL`, `lieu_id`) |
| `base` | la base Docker du jeu où l'exporteur lit les bâtiments |
| `echelle` | mètres par unité du plan |
| `arrondi` | le pas d'arrondi des distances au-delà de 100 m |
| `calques` | les calques du SVG (leur `id`) qui jouent chaque rôle : `rues` (ce qui se parcourt), `ponts`, `obstacles` (les maisons), `murs`, `eau` |
| `interieur` | un point à l'intérieur des murs : l'intérieur est tout ce qui s'en atteint sans franchir un mur, l'eau ou une maison |
| `portes` | chaque porte, un point au milieu de son passage ; un disque de `rayon_porte` unités y ouvre la muraille |
| `marge_batiment` | autour d'un bâtiment, la bande où l'on peut en trouver la porte (en unités) |
| `en_ville`, `hors_les_murs` | les repères, chacun avec un `nom` (court, pour les tableaux du terminal), un `libelle` facultatif (le nom dans les trajets du wiki) et une position (ci-dessous) |
| `places`, `rayon_places` | les places à mesurer (un point au milieu de chacune) |
| `vitesses` | les allures des trajets, en km/h (`{"À pied": 4.5, "Charrette": 3}`), une colonne chacune |
| `trajets` | `en_ville` et `hors_les_murs` : les paires de repères (par leur `nom`) des tableaux de trajets |
| `variante_trajets` | les distances en ville des trajets : `ouvert` (parcs compris, par défaut) ou `rues` |

Un repère se place par :

- `"lieu": "La tour Blanche"` : un lieu du plan sans bâtiment, par son titre ;
- `"batiment": ["GU", 25]` : un bâtiment, par son secteur et son numéro ;
- `"porte": "Porte Nord"` : une porte de `portes` ;
- `"point": [1650, 820]` : un point du plan, en unités (les coordonnées du `viewBox` du SVG).

Un bâtiment se rejoint par le point le plus proche de son pourtour (sa porte peut être n'importe où) ;
`"centre": true` vise plutôt le milieu de sa forme (une place, une plage).

## Comment il calcule

Le moteur dessine chaque calque du plan dans un canevas à une unité par pixel (dans le navigateur,
une toile hors écran ; sous Node, `@napi-rs/canvas`, le même moteur de dessin que Chrome) et en tire
des masques : ce qui se parcourt, l'intérieur des murs, les portes. Les plus courts chemins sont ceux
de Dijkstra sur cette grille (A* pour un seul trajet : même résultat, plus vite), en seize
directions (l'écart avec la vraie longueur d'un trajet reste sous 3 %), sans couper les coins des
maisons. Le plan de Vahal fait 2 088 × 1 971 unités : quatre millions de cases. Dans la page, le
calcul tourne dans un Web Worker pour ne pas la figer.

Les résultats ont été comparés, le 17 octobre 2026, à ceux du premier outil (un script PHP qui
faisait calculer Chrome) : distances, vols d'oiseau, intérieur des murs et places identiques au
dixième d'unité près, et les tests le vérifient encore sur quelques trajets de Vahal.

## L'arborescence

| Chemin | Rôle |
|--------|------|
| `index.html`, `src/main.js` | la page et son point d'entrée : charge la ville, monte le plan et les onglets |
| `src/css/app.css` | le style de la page (thème clair et sombre) |
| `src/reglages.js` | la configuration telle que la page la modifie |
| `src/geometrie.js` | le centre et la boîte d'un repère (page et moteur) |
| `src/donnees/` | le chargement d'une ville, les repères et leur géométrie, le catalogue des choix |
| `src/moteur/calculs.js` | les calculs (preparer, portes, trajet, matrice, places), pour la page comme pour Node |
| `src/moteur/worker.js`, `client.js` | les calculs dans un Web Worker, et le moteur vu de la page (une promesse par demande) |
| `src/moteur/terrain.js`, `raster.js` | les masques (sol, intérieur des murs, portes, les trois façons de marcher), dessinés depuis les calques |
| `src/moteur/chemins.js`, `tas.js`, `departs.js`, `grille.js`, `places.js` | Dijkstra et A*, le tas, les cases d'un repère, la grille, la mesure des places |
| `src/vue/` | le plan (zoom, calques, clics), les onglets, les formats (mètres, minutes) et les exports (DokuWiki, presse-papiers) |
| `public/villes/` | les données des villes (copiées telles quelles dans `dist/`) |
| `outils/` | l'outil en ligne de commande (`mesurer.js`), l'exporteur (`exporter.js`), et ce qu'ils partagent sous Node |
| `tests/` | les tests (`npm test`, le lanceur de Node) |
| `Dockerfile`, `compose.yaml`, `docker/` | l'image Docker (construite par Vite, servie par nginx) |

## Tests

```bash
npm test
```

Le tas, les formats et les arrondis du wiki, les repères, et le moteur : un petit plan fait main,
puis quelques distances de Vahal, qui doivent rester celles de la page du wiki.
