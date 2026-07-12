# Bad Club Nérondais — site web (B.C.N. 18)

Site vitrine du club de badminton de Nérondes. Site **statique** (format Claude Design `.dc.html` + runtime `support.js`), déployé via **Netlify**.

## Structure
- `index.html` = page d'accueil (copie de `Accueil.dc.html`).
- Pages : `Le Club`, `Creneaux et Tarifs`, `Actualites`, `Galerie`, `Le Bureau`, `Liens utiles`, `Contact` (`.dc.html`).
- `assets/` : images + logo + modèle 3D `badminton2.glb`.
- `scripts/fetch-ffbad.mjs` + `.github/workflows/ffbad-actus.yml` : robot d'actualités FFBad.

## Déploiement Netlify
- Publish directory : **`.`** (racine), **aucune commande de build**.

## Actualités FFBad (mise à jour automatique)
1. Le workflow GitHub `ffbad-actus.yml` lance `scripts/fetch-ffbad.mjs` **1×/jour** (+ bouton « Run workflow »).
2. Il récupère les dernières actus de la FFBad, écrit `ffbad-actus.json` et le commit.
3. Netlify redéploie automatiquement → la page Actualités affiche les nouvelles actus.

**À activer une seule fois** : `Settings → Actions → General → Workflow permissions → Read and write`, puis lancer le workflow une première fois (onglet Actions → Run workflow).
