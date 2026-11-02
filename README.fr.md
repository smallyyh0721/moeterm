# kittyTerm

[中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Español](README.es.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Un terminal libre pour Windows, dans l'esprit d'un Linux classique. Il sert à ouvrir SSH, à transférer des fichiers, et à laisser un animal de bureau bouger dans un coin.

kittyTerm reste sur le travail d'un terminal : connexions enregistrées, shell, SFTP et journaux. La fenêtre est sombre, et le chat blanc de la barre de titre est son signe. Au démarrage, ce chat avance sur une barre de 0 % à 100 %.

[Télécharger l'installateur Windows](https://github.com/smallyyh0721/moeterm/releases/tag/v2.0.0)

![Accueil](docs/style-previews/current.png)

## Fonctions

- Terminal SSH. Connexion par mot de passe ou clé privée. La clé d'hôte est retenue au premier contact, et un changement ultérieur est bloqué jusqu'à votre accord.
- SFTP sur la même connexion. Les envois et les réceptions affichent la progression et la vitesse.
- Les connexions sont rangées dans des dossiers à gauche. **Tout ouvrir** lance chaque session du dossier.
- Copier et coller. Le clic droit exporte la sélection ou tout le tampon en fichier texte.
- Chaque terminal a son journal. Le dossier des journaux se change tout de suite. Le dossier des données prend effet après un redémarrage.
- Partager l'écran en deux, trois ou quatre cadres. Une fenêtre neuve commence avec un seul cadre. Chaque cadre affiche le nom de la session en haut.
- Trois apparences : vert classique, orange et noir, brun chaud. Les thèmes orange et brun montrent un portrait sur l'accueil.
- L'animal de bureau se cache, se déplace et change de pose. Le pointeur posé dessus fait apparaître une blague de programmeur. On peut installer un autre animal depuis Petdex, ou importer un paquet local.
- Ctrl et la molette changent la taille du texte. F11 passe en plein écran.
- Après un échec de connexion, R réessaie et Entrée ferme ce terminal.

![Orange et noir](docs/style-previews/zzz.png)

![Brun chaud](docs/style-previews/fff.png)

![Deux cadres](docs/split-preview/split-2.png)

![Quatre cadres](docs/split-preview/split-4.png)

## Installation

L'installateur est `kittyTerm Setup 2.0.0.exe`, pour Windows 10 / 11 x64. Il s'installe pour l'utilisateur courant, sans administrateur. Sans certificat de signature, SmartScreen peut signaler un éditeur inconnu. Choisissez quand même d'exécuter.

Après l'installation, les données sont dans le dossier `data` du répertoire choisi. En développement, elles restent dans `%APPDATA%\kittyTerm`.

| Chemin | Contenu |
| --- | --- |
| `tree.json` | Dossiers et connexions, sans mots de passe |
| `secrets.json` | Mots de passe et phrases de clé, chiffrés avec le DPAPI de l'utilisateur Windows |
| `keys\` | Clés privées importées |
| `known_hosts.json` | Clés d'hôte connues |
| `logs\` | Journaux. Ce dossier peut être déplacé |
| `settings.json` | Taille du texte, animal, thème et journal |

Sur un autre ordinateur, les fichiers de clé restent, mais les mots de passe enregistrés sont à saisir de nouveau. Si les données sont encore dans le dossier d'installation, la désinstallation les efface. Déplacez d'abord le dossier des données si vous voulez les garder.

## Développement

```powershell
npm install
npm test
npm run dev
```

Empaqueter :

```powershell
npm test
npm run build
npm run smoke
npm run pack
```

## Licence

MIT
