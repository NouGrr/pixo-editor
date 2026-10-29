# Pixo

Pixo est un éditeur photo directement utilisable dans le navigateur. Il fonctionne côté client : les images importées restent dans le navigateur et aucune installation n'est nécessaire.

## Ouvrir Pixo en ligne

👉 [Ouvrir Pixo](https://nougrr.github.io/pixo-editor/)

## Utilisation rapide

1. Ouvrez [la nouvelle version de Pixo](https://nougrr.github.io/pixo-editor/).
2. Cliquez sur **Choisir une image**, ou déposez une image dans la zone centrale.
3. Sélectionnez une catégorie dans la barre de gauche :
   - **Recadrer** ;
   - **Ajuster** ;
   - **Retouche**.
4. Réglez l'image avec les contrôles disponibles.
5. Cliquez sur **Exporter** pour télécharger le résultat.

## Fonctionnalités

### Recadrer

- formats libres et réseaux sociaux ;
- Instagram carré, portrait et paysage ;
- Story, Reel, Snap Story, TikTok et YouTube Short ;
- formats X/Twitter, Facebook, LinkedIn et YouTube ;
- largeur et hauteur personnalisées ;
- aperçu du format avant application ;
- rotation à 90 degrés ;
- symétrie horizontale et verticale ;
- redressement de l'image.

Le format sélectionné est affiché en aperçu. L'image n'est modifiée définitivement qu'après avoir cliqué sur **Appliquer le recadrage**.

### Ajuster

- exposition ;
- contraste ;
- hautes lumières et ombres ;
- clarté et réduction du voile ;
- saturation et vibrance ;
- température et teinte ;
- netteté globale ;
- vignette avec couleur personnalisable ;
- réglages rapides réversibles.

### Retouche

- correction locale ;
- tampon avec source fixe ;
- flou avec densité et intensité réglables ;
- netteté locale ;
- éclaircissement et assombrissement avec l'outil Densité ;
- détourage automatique avec IMG.LY ;
- ajout et retrait manuel sur le masque ;
- aperçu et export en 4K ;
- conversion en PNG, JPG, WebP ou AVIF ;
- historique, annulation et rétablissement.

## Détourage automatique

Le détourage IMG.LY est chargé directement dans le navigateur depuis un CDN et utilise WebAssembly. Il ne nécessite pas de clé API. Le premier lancement peut demander quelques instants pour charger le modèle.

## Formats pris en charge

L'import accepte les formats d'image pris en charge par le navigateur. Les exports disponibles sont :

- PNG ;
- JPG ;
- WebP ;
- AVIF.

## Développement local

Pixo est une application statique sans framework ni serveur obligatoire. Pour l'utiliser localement, ouvrez `index.html` dans un navigateur.

Pour éviter les restrictions du navigateur liées aux fichiers locaux, vous pouvez démarrer un serveur statique, par exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrez <http://localhost:8000>.

## Publication

Le site est publié avec GitHub Pages. Les modifications envoyées sur la branche `main` sont déployées automatiquement par le workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Confidentialité

Les retouches et les exports sont réalisés côté navigateur. Les images importées ne sont pas envoyées à un serveur Pixo.
