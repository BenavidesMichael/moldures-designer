# Moldures Designer — Documentation des fonctionnalités

Application web de conception de murs décorés avec cadres de moulures. Permet de planifier,
visualiser et chiffrer la pose de moulures sur un ou plusieurs murs.

---

## Sommaire

1. [Gestion de projet](#1-gestion-de-projet)
2. [Configuration du mur](#2-configuration-du-mur)
3. [Système de cadres](#3-système-de-cadres)
4. [Obstacles](#4-obstacles)
5. [Bibliothèque de moulures](#5-bibliothèque-de-moulures)
6. [Budget](#6-budget)
7. [Rendu canvas](#7-rendu-canvas)
8. [Export PDF](#8-export-pdf)
9. [Intelligence artificielle (Gemini)](#9-intelligence-artificielle-gemini)
10. [Paramètres](#10-paramètres)
11. [Interface utilisateur](#11-interface-utilisateur)
12. [Persistance des données](#12-persistance-des-données)

---

## 1. Gestion de projet

### Onglet Projet
Hub central de gestion des murs et du projet.

| Action | Description |
|--------|-------------|
| Lister les murs | Affiche tous les murs du projet avec leur nom |
| Activer un mur | Clic sur le nom du mur → le mur s'affiche sur le canvas |
| Ajouter un mur | Bouton "+ Ajouter un mur" → crée un mur avec dimensions par défaut |
| Renommer | Icône crayon → édition du nom en ligne |
| Dupliquer | Icône presse-papiers → copie complète du mur (zones, cadres, obstacles) |
| Supprimer | Icône corbeille → suppression avec confirmation et possibilité d'annuler |
| Réinitialiser | Remet le projet aux valeurs par défaut (avec confirmation) |

**Nom du projet** affiché dans l'en-tête, mis à jour en temps réel.

### Sauvegarde automatique
Toute modification est enregistrée instantanément dans le `localStorage`. Au prochain chargement de l'application, le projet est restauré automatiquement avec un message de confirmation.

### Annulation / Rétablissement
- **Ctrl+Z** — annule la dernière action
- **Ctrl+Y** — rétablit l'action annulée
- Historique limité à 50 états, stocké en mémoire

### Import / Export
- **Sauvegarder** — télécharge le projet complet en fichier `.json`
- **Charger** — importe un fichier `.json` (validé par schéma Zod, avec migration automatique)

---

## 2. Configuration du mur

### Onglet Mur
Définit les dimensions physiques et l'apparence visuelle du mur.

**Dimensions**

| Champ | Description | Limites |
|-------|-------------|---------|
| Largeur | Largeur totale du mur (cm) | 50–2000 cm |
| Hauteur | Hauteur totale du mur (cm) | 50–500 cm |
| Plinthe | Hauteur de la plinthe au sol (cm) | 0–50 cm |

**Zones**

- **1 zone** — un seul espace de cadres sur toute la hauteur utile
- **2 zones** — espace divisé en zone haute et zone basse par un séparateur/rail horizontal

**Couleurs**

| Réglage | Description |
|---------|-------------|
| Couleur du mur | Fond du mur (picker couleur) |
| Couleur des moulures | Override global sur toutes les moulures (case à cocher pour activer) |
| Couleur de la plinthe | Couleur de la plinthe au bas du mur |

**Annotations**
Six indicateurs de cotes indépendants, activables/désactivables :
- Dimensions totales du mur
- Dimensions des cadres
- Espaces entre cadres
- Cotes des obstacles
- Hauteur de plinthe
- Hauteur utile (entre plinthe et plafond)

---

## 3. Système de cadres

### Onglet Cadres
Conçoit les cadres rectangulaires décoratifs dans chaque zone du mur.

### Compteur de cadres
Boutons 1 à 6 pour choisir le nombre de cadres par zone. Les cadres sont répartis automatiquement dans l'espace disponible.

### Marges & gaps *(section repliable)*
| Champ | Description |
|-------|-------------|
| Marge gauche / droite / haut / bas | Espace entre le bord de la zone et le premier/dernier cadre (cm) |
| Gap entre cadres | Espace entre deux cadres adjacents (cm) |

### Tailles personnalisées *(section repliable)*
Tableau permettant de fixer une largeur et/ou une hauteur spécifique pour chaque cadre. La valeur **0 = automatique** (calculée par le moteur de layout).

### Carte cadre *(section dépliable par cadre)*
Chaque cadre possède sa propre configuration :

| Réglage | Description |
|---------|-------------|
| Moulure | Sélection dans la bibliothèque de moulures du projet |
| Style d'angle | **Onglet** (coupe à 45°) ou **Rosette** (pièce d'angle décorative) |
| Rosette | Sélection de la rosette à utiliser (si style = rosette) |
| Sous-cadres | Cadres imbriqués concentriques (voir ci-dessous) |

### Sous-cadres (niveaux imbriqués)
Des cadres supplémentaires peuvent être ajoutés à l'intérieur d'un cadre principal.
Chaque niveau possède :
- **Moulure** — profil utilisé pour ce niveau
- **Décalage** — retrait par rapport au cadre parent (cm)
- **Style d'angle** — onglet ou rosette, avec sélection de rosette
- **Bouton supprimer** — retire ce niveau

### Séparateur / Rail *(visible en mode 2 zones)*
| Réglage | Description |
|---------|-------------|
| Position | Slider 20–80 % de la hauteur utile |
| Afficher | Rend le rail visible ou invisible sur le canvas |
| Moulure rail | Profil de moulure utilisé pour le rail horizontal |

---

## 4. Obstacles

### Onglet Obstacles
Gère les éléments physiques du mur (fenêtres, portes, prises…) qui contraignent le placement des cadres.

**Types disponibles :** fenêtre, porte, radiateur, prise électrique, interrupteur, cheminée, personnalisé.

### Liste des obstacles
| Contrôle | Description |
|----------|-------------|
| Icône type | Représentation visuelle du type d'obstacle |
| Nom + dimensions | Affichage en lecture seule |
| Œil | Basculer la visibilité de l'obstacle sur le canvas |
| Afficher / Masquer tout | Contrôle global de visibilité |
| Crayon | Ouvre le formulaire d'édition |
| Corbeille | Supprime l'obstacle (annulable) |
| Ajouter | Crée un nouvel obstacle |

### Formulaire d'obstacle
| Champ | Description |
|-------|-------------|
| Type | Dropdown parmi les 7 types disponibles |
| Nom | Nom libre |
| Largeur / Hauteur | Dimensions en cm |
| Position X | Distance depuis le bord gauche du mur (cm) |
| Position Y | Distance depuis le sol (cm) |
| Transparent | Affiche l'obstacle sans remplissage (cadres visibles derrière) |
| Couleur | Couleur de remplissage |

*Validation : l'obstacle ne peut pas dépasser les limites du mur.*

### Glisser-déposer sur le canvas
- **Survol** → curseur « grab » si obstacle sous la souris
- **Cliquer-glisser** → déplace l'obstacle en temps réel avec prévisualisation live
- **Relâcher** → position définitive enregistrée dans l'historique
- **Sortie du canvas** → position validée au dernier emplacement valide
- Les cadres qui chevauchent un obstacle visible sont mis en évidence en rouge.

---

## 5. Bibliothèque de moulures

### Onglet Moulures
Bibliothèque commune à tous les murs du projet.

### Section Moulures

**Liste** — pour chaque moulure :
| Élément | Description |
|---------|-------------|
| Pastille couleur | Aperçu visuel de la couleur de la moulure |
| Nom | Nom de la moulure |
| Dimensions | Largeur × épaisseur (mm) |
| Longueur de barre | Longueur unitaire d'une barre (cm) |
| Prix / barre | Coût d'une barre (€) |
| Lien d'achat | Lien direct vers le fournisseur ou recherche Amazon générée automatiquement |
| Crayon | Ouvre le formulaire d'édition |
| Corbeille | Supprime la moulure (annulable) |

**Ajouter** — ouvre le formulaire de création de moulure.

**Importer via Gemini** — extraction automatique à partir d'une description produit.

### Formulaire de moulure
| Champ | Description |
|-------|-------------|
| Nom | Nom de la moulure |
| Référence | Code fournisseur |
| Largeur (mm) | Largeur visible du profil |
| Épaisseur (mm) | Profondeur du profil |
| Longueur de barre (cm) | Longueur d'une barre commerciale |
| Prix / barre (€) | Prix d'achat unitaire |
| Couleur | Couleur affichée sur le canvas |
| Matériau | Wood, MDF, PVC, Polystyrène, Polyuréthane, Autre |
| URL d'achat | Lien fournisseur (doit commencer par http:// ou https://) |

**Conseiller matériau** *(section dépliable)*
Lorsqu'un matériau est sélectionné, affiche :
- Avantages du matériau
- Mises en garde
- Fourchette de prix (€ / €€ / €€€)
- Usage recommandé

### Import Gemini
Extraction automatique des caractéristiques d'une moulure à partir d'une description texte (fiche produit, copier-coller d'une page web) :
1. Coller l'URL du produit *(optionnel)*
2. Coller la description texte du produit *(obligatoire)*
3. Cliquer **Extraire**
4. Le formulaire de moulure se pré-remplit avec les données extraites
5. Vérifier et corriger si nécessaire, puis sauvegarder

### Section Rosettes
Pièces décoratives d'angle utilisées à la place des coupes à 45°.

**Formulaire :**
| Champ | Description |
|-------|-------------|
| Nom | Nom de la rosette |
| Taille (cm) | Dimensions carrées de la pièce |
| Prix / pièce (€) | Coût unitaire |

---

## 6. Budget

### Onglet Budget
Calcul automatique et temps réel du matériel nécessaire et de son coût.

**Tableau moulures**

| Colonne | Description |
|---------|-------------|
| Moulure | Nom de la moulure |
| Mètres linéaires | Longueur totale calculée pour tous les cadres utilisant cette moulure |
| Chute | Facteur de perte appliqué (+15 % pour les cadres, 0 % pour le rail) |
| Barres | Nombre de barres à acheter : `⌈mètres / longueur_barre⌉` |
| Prix / barre | Coût unitaire de la barre |
| Total | Coût total pour cette moulure |

**Tableau rosettes**

| Colonne | Description |
|---------|-------------|
| Rosette | Nom |
| Quantité | Nombre de pièces (4 par cadre avec rosettes) |
| Prix / pièce | Coût unitaire |
| Total | Coût total |

**Total général** — somme de toutes les moulures et rosettes, en euros.

**Règles de calcul :**
- Périmètre d'un cadre = somme des 4 côtés, longueur de chaque côté réduite de 2× la taille de la rosette si style = rosette
- Sous-cadres : périmètre calculé avec le décalage cumulatif
- Rail : largeur du mur, sans facteur de perte

---

## 7. Rendu canvas

### Visualisation en temps réel
Le canvas se met à jour instantanément à chaque modification.

**Éléments dessinés :**
| Élément | Description |
|---------|-------------|
| Fond du mur | Rectangle de la couleur configurée |
| Plinthe | Bande horizontale au bas du mur |
| Cadres | Profils avec effet biseauté 3D (clair en haut/gauche, sombre en bas/droite) |
| Rosettes | Carrés décoratifs aux angles des cadres |
| Sous-cadres | Cadres imbriqués concentriques |
| Rail | Barre horizontale entre les zones (mode 2 zones) |
| Obstacles | Rectangles colorés (opaques ou transparents selon le réglage) |
| Collision | Contour rouge sur les cadres chevauchant un obstacle visible |
| Annotations | Cotes dimensionnelles (voir section Mur) |

**Couleurs des moulures :**
- Si la couleur globale des moulures est activée dans l'onglet Mur → toutes les moulures prennent cette couleur
- Sinon → chaque moulure utilise sa propre couleur

### Zoom
- **Molette souris** — zoom de 0,2× à 8×
- Zoom centré sur le milieu du canvas
- Réinitialisé automatiquement lors du changement de mur actif

### Redimensionnement automatique
Le canvas s'adapte à la taille du panneau et de la fenêtre. Un `ResizeObserver` redessine automatiquement à chaque changement de taille.

### Panneau redimensionnable
Le panneau de droite peut être redimensionné horizontalement en faisant glisser la bordure de séparation (largeur min 220 px, max 600 px). La largeur est mémorisée entre les sessions.

---

## 8. Export PDF

### PDF — Mur actif
Exporte le mur actuellement affiché.

**Page 1 :**
- En-tête : nom du projet, nom du mur, date de génération
- Rendu haute résolution du canvas (1600 px côté long)
- Tableau des dimensions du mur (largeur, hauteur, plinthe, hauteur utile, mode de zones)

**Page 2 :**
- Tableau des mesures des cadres (zone, numéro, largeur cm, hauteur cm, périmètre cm)
- Tableau du budget (moulure, mètres, chute, barres, prix, total)
- Pied de page avec numéro de page

### PDF — Tous les murs
Exporte tous les murs du projet en un seul fichier PDF, un mur par page, dans le même format.

*Format : A4 paysage, généré avec jsPDF + autoTable.*

---

## 9. Intelligence artificielle (Gemini)

### Rendu de mur IA
Génère une image photoréaliste du mur décoré à partir des paramètres du design.

**Utilisation :**
1. Configurer la clé API dans les Paramètres (⚙️)
2. Cliquer **✦ Gemini** dans la barre d'outils
3. L'image générée s'affiche dans une modale avec un bouton de téléchargement

**Prompt envoyé à l'IA :** dimensions du mur, couleurs, nombre de cadres par zone, position du séparateur, obstacles, style Haussmannien.

**Modèles disponibles :**
| Modèle | Description | Niveau |
|--------|-------------|--------|
| Gemini 2.5-flash Image | Rapide, niveau gratuit (recommandé) | Gratuit |
| Imagen 4.0 | Qualité supérieure | Payant |

### Extraction de données moulures
Analyse une description texte de produit pour en extraire automatiquement les caractéristiques (voir section [Import Gemini](#import-gemini)).

*Modèle utilisé : Gemini 2.5-flash (texte).*

---

## 10. Paramètres

### Modal Paramètres (⚙️)
| Champ | Description |
|-------|-------------|
| Clé API Gemini | Clé personnelle pour les fonctions IA (stockée localement, non transmise) |
| Modèle Gemini | Sélection du modèle de génération d'image |

*Si l'utilisateur est connecté avec Google mais n'a pas encore de clé : lien direct vers Google AI Studio pour en créer une gratuitement.*

---

## 11. Interface utilisateur

### Navigation par onglets
6 onglets avec icônes SVG et libellés : **Projet · Mur · Cadres · Obstacles · Moulures · Budget**.

### Notifications (toasts)
Messages discrets en bas à gauche :
- ✅ Succès (import, restauration, etc.)
- ❌ Erreur (fichier invalide, erreur API, etc.)
- ↩ Annulation avec bouton **Undo** pour les suppressions

### Modales
Système de fenêtres modales réutilisables :
- Fermeture via bouton ✕, touche **Échap**, ou clic sur l'arrière-plan
- Validation des formulaires avant soumission
- États de chargement avec boutons désactivés

### Raccourcis clavier
| Raccourci | Action |
|-----------|--------|
| Ctrl+Z | Annuler |
| Ctrl+Y | Rétablir |
| Échap | Fermer la modale |

### Thème visuel
Thème « atelier artisanal » :
- Tons crème chauds pour les panneaux
- Canvas sombre (fond #141210)
- Typographie : Cormorant Garamond (titres) + Jost (interface)
- Zones colorées distinctes : zone haute (accent brun-orange), zone basse (violet)

---

## 12. Persistance des données

### localStorage
| Clé | Contenu |
|-----|---------|
| `moldures_project` | Projet complet en JSON |
| `moldures_gemini_key` | Clé API Gemini |
| `moldures:panel-width` | Largeur mémorisée du panneau de droite |

### Validation des données
- Schémas Zod pour la validation à l'import
- Migration automatique : ancien champ `showAnnotations: boolean` → nouvel objet `annotations` (drapeaux indépendants)
- Valeurs par défaut appliquées si donnée manquante ou corrompue

---

## Stack technique

| Élément | Technologie |
|---------|-------------|
| Templating UI | lit-html |
| Langage | TypeScript strict |
| Rendu | Canvas 2D API |
| Styling | Tailwind CSS v4 + variables CSS |
| État | Store réactif custom (subscribe/setState) |
| Immutabilité | Immer.js |
| Validation | Zod |
| PDF | jsPDF + jspdf-autotable |
| IA | Google Gemini API |
| Build | Vite |
| Tests | Vitest + jsdom |

---

## Structure des fichiers

```
src/
├── index.ts                     # Boot, raccourcis, toolbar
├── types/
│   ├── index.ts                 # Types TypeScript (Project, Wall, Zone, Frame…)
│   └── schemas.ts               # Schémas Zod + migrations
├── state/
│   ├── AppState.ts              # Store réactif, historique undo/redo
│   ├── defaults.ts              # Valeurs par défaut du projet
│   └── storage.ts               # localStorage, import/export JSON
├── services/
│   ├── layout.ts                # Calcul des positions et tailles des cadres
│   ├── budget.ts                # Calcul du budget matériaux
│   ├── pdf.ts                   # Génération PDF
│   └── gemini.ts                # Appels API Gemini (image + extraction)
├── renderer/
│   ├── Renderer.ts              # Canvas principal, zoom, drag obstacles
│   ├── drawFrames.ts            # Dessin des cadres et rosettes
│   ├── drawObstacles.ts         # Dessin des obstacles
│   └── drawAnnotations.ts       # Dessin des cotes et annotations
├── ui/
│   ├── Panel.ts                 # Conteneur d'onglets
│   ├── WallPanel.ts             # Onglet Mur
│   ├── FramesPanel.ts           # Onglet Cadres
│   ├── ObstaclesPanel.ts        # Onglet Obstacles
│   ├── MoldingsPanel.ts         # Onglet Moulures (avec import Gemini)
│   ├── BudgetPanel.ts           # Onglet Budget
│   ├── SettingsModal.ts         # Modal paramètres
│   └── toast.ts                 # Système de notifications
└── style.css                    # Design system, tokens CSS, composants
```
