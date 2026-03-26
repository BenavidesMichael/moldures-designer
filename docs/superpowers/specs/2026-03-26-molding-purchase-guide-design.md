# Design — Guide d'achat de moulures & Import Gemini

**Date :** 2026-03-26
**Projet :** Moldures Designer
**Statut :** Approuvé

---

## Objectif

Faciliter l'achat de moulures en ligne en ajoutant trois capacités complémentaires à l'application :

1. **Import assisté par Gemini** — l'utilisateur colle le texte d'une fiche produit (Amazon ou autre), Gemini extrait automatiquement les dimensions et pré-remplit le formulaire
2. **Liens d'achat par moulure** — chaque moulure peut stocker un lien d'achat (toute URL) ; si absent, un bouton génère une recherche Amazon
3. **Conseiller matériaux** — fiche expert intégrée dans le formulaire pour informer l'utilisateur sur chaque matériau (bois, MDF, PVC, polystyrène, polyuréthane) sans bloquer son choix
4. **Connexion Google + guide clé Gemini** — Google Sign-In pour identifier l'utilisateur et le guider vers sa propre clé API Gemini gratuite

Le flux d'ajout manuel existant est **entièrement conservé**. Tous les changements sont additifs.

---

## Contexte existant

| Élément | Description |
|---------|-------------|
| `MoldingsPanel.ts` | Formulaire d'ajout/édition de moulures avec modal custom (`#app-modal`) |
| `src/services/gemini.ts` | Service Gemini existant — clé API stockée dans `localStorage` |
| `⚙ Paramètres IA` | Modal settings existant pour entrer la clé API Gemini |
| `showInputModal` / `showToast` | Helpers UI déjà présents |

---

## Design

### 1. Modèle de données

Deux nouveaux champs optionnels sur `Molding`, rétrocompatibles (projets existants non impactés) :

```typescript
type MoldingMaterial =
  | 'wood'
  | 'mdf'
  | 'pvc'
  | 'polystyrene'
  | 'polyurethane'
  | 'other'

interface Molding {
  // ... champs existants inchangés ...
  material?: MoldingMaterial  // type de matériau
  purchaseUrl?: string        // lien d'achat (Amazon, Leroy Merlin, etc.)
}
```

Les anciens projets sans ces champs sont traités comme `undefined` — aucune migration nécessaire.

---

### 2. Import depuis fiche produit (Gemini)

Un bouton secondaire **"⬇ Importer depuis fiche produit"** s'ajoute à côté du bouton d'ajout manuel existant dans `MoldingsPanel`.

#### Flux

1. L'utilisateur clique "Importer depuis fiche produit"
2. Un modal s'ouvre (`ImportModal`) avec :
   - Champ optionnel : URL du produit (Amazon ou autre)
   - Zone de texte obligatoire : texte de la fiche produit (copier-coller depuis la page)
   - Bouton "Extraire avec Gemini ✨"
3. Gemini reçoit le texte et retourne un JSON structuré
4. Le formulaire standard de moulure s'ouvre pré-rempli avec les données extraites + l'URL stockée comme `purchaseUrl`
5. L'utilisateur corrige si nécessaire, puis enregistre

#### Prompt Gemini (extraction)

```
Tu es un expert en moulures décoratives. Extrais les informations suivantes
depuis ce texte de fiche produit et retourne UNIQUEMENT un JSON valide.

Texte: """
{userPastedText}
"""

JSON attendu (null si champ non trouvé) :
{
  "name": string | null,
  "material": "wood"|"mdf"|"pvc"|"polystyrene"|"polyurethane"|"other"|null,
  "width": number | null,        // largeur visible en mm
  "thickness": number | null,    // épaisseur en mm
  "barLength": number | null,    // longueur d'une barre en cm
  "pricePerBar": number | null,  // prix unitaire en euros
  "reference": string | null     // référence produit
}
```

#### Comportements d'erreur

- Gemini indisponible (pas de clé) → bouton "Importer" grisé, tooltip "Configurez Gemini dans les paramètres"
- JSON invalide retourné par Gemini → toast erreur "Extraction échouée — remplissez manuellement"
- Champs partiellement extraits → formulaire pré-rempli avec ce qui a été trouvé, champs vides à compléter

---

### 3. Liens d'achat

#### Dans le formulaire (ajout/édition)

Un champ optionnel "Lien d'achat" s'ajoute en bas du formulaire existant :

```
Lien d'achat  [________________________________]
              https://amazon.fr/dp/... ou autre URL
```

#### Dans la liste du catalogue

Chaque entrée moulure affiche l'un des deux boutons selon l'état du `purchaseUrl` :

- **`🛒 Acheter`** — si `purchaseUrl` défini → ouvre l'URL dans un nouvel onglet (`target="_blank" rel="noopener"`)
- **`🔍 Trouver sur Amazon`** — si pas de `purchaseUrl` → génère une recherche :

```typescript
function generateAmazonSearchUrl(molding: Molding): string {
  const terms = [molding.name, molding.reference].filter(Boolean).join(' ')
  return `https://www.amazon.fr/s?k=${encodeURIComponent(terms + ' moulure')}`
}
```

Toute URL est acceptée dans `purchaseUrl` — Amazon, Leroy Merlin, Castorama, ManoMano, etc.

---

### 4. Conseiller matériaux

Quand l'utilisateur sélectionne un matériau dans le formulaire, une fiche expert s'affiche en dessous — dépliable, ouverte par défaut.

#### Principe directeur

Le conseiller **informe sans bloquer**. L'utilisateur choisit librement son matériau. Les informations sur la sensibilité à l'humidité (bois, MDF) sont présentées comme des conseils pratiques, pas comme des interdictions.

#### Données embarquées (pas d'API externe)

```typescript
const MATERIAL_INFO: Record<MoldingMaterial, MaterialInfo> = {
  wood: {
    label: 'Bois massif',
    icon: '🪵',
    pros: [
      'Aspect authentique et haut de gamme',
      'Se peint et se teinte facilement',
      'Durable dans le temps',
    ],
    notes: [
      'Sensible à l\'humidité — prévoir une primaire d\'étanchéité en zone humide',
    ],
    priceRange: '€€€',
    idealFor: 'Salon, chambre, couloir, pièce de prestige',
  },
  mdf: {
    label: 'MDF',
    icon: '📋',
    pros: [
      'Surface parfaitement lisse',
      'Facile à peindre',
      'Économique',
    ],
    notes: [
      'Absorbe l\'humidité — une couche d\'apprêt ou de peinture adaptée suffit généralement',
    ],
    priceRange: '€€',
    idealFor: 'Salon, chambre, bureau',
  },
  pvc: {
    label: 'PVC',
    icon: '💧',
    pros: [
      'Étanche et imputrescible',
      'Léger et facile à poser',
      'Entretien facile',
    ],
    notes: [
      'Difficile à peindre sans primaire spécifique PVC',
    ],
    priceRange: '€',
    idealFor: 'Salle de bain, cuisine, pièces humides',
  },
  polystyrene: {
    label: 'Polystyrène',
    icon: '🫧',
    pros: [
      'Très léger',
      'Économique',
      'Pose simple (colle ou adhésif)',
    ],
    notes: [
      'Plus fragile que les autres matériaux',
    ],
    priceRange: '€',
    idealFor: 'Décoration intérieure, budget serré',
  },
  polyurethane: {
    label: 'Polyuréthane',
    icon: '✨',
    pros: [
      'Imitation bois très convaincante',
      'Léger et résistant aux chocs',
      'Bonne résistance à l\'humidité',
    ],
    notes: [],
    priceRange: '€€',
    idealFor: 'Salon, couloir, escalier',
  },
  other: {
    label: 'Autre matériau',
    icon: '📦',
    pros: [],
    notes: ['Renseignez-vous auprès du fabricant pour les spécificités de pose'],
    priceRange: '—',
    idealFor: '—',
  },
}
```

---

### 5. Connexion Google + guide clé Gemini

Le modal `⚙ Paramètres IA` est enrichi avec une option de connexion Google.

#### État initial (non connecté)

```
┌──────────────────────────────────────────┐
│  ✕  Paramètres IA                        │
│                                          │
│  [G  Se connecter avec Google]           │
│                                          │
│  ── ou ──                                │
│                                          │
│  Clé API Gemini                          │
│  [____________________________________]  │
│  [Enregistrer]                           │
└──────────────────────────────────────────┘
```

#### Après connexion Google

```
┌──────────────────────────────────────────┐
│  ✕  Paramètres IA                        │
│                                          │
│  ● Jean Dupont  jean@gmail.com           │
│    [Se déconnecter]                      │
│                                          │
│  Clé API Gemini                          │
│  [AIza... (configurée ✓)______________]  │
│  [Enregistrer]                           │
│                                          │
│  Pas encore de clé ?                     │
│  → Obtenir ma clé gratuite sur           │
│    aistudio.google.com — connectez-vous  │
│    avec le même compte Google            │
└──────────────────────────────────────────┘
```

#### Contraintes techniques

- **Google Identity Services (GIS)** — bibliothèque client Google, 100% frontend, pas de backend
- La connexion Google sert uniquement à l'identification visuelle et au lien guidé vers AI Studio
- La clé API reste stockée dans `localStorage` comme aujourd'hui
- Sans connexion Google, la clé fonctionne exactement comme avant — aucune régression
- Aucune donnée utilisateur n'est envoyée à un serveur tiers

---

## Architecture — fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/types/index.ts` | Ajouter `MoldingMaterial`, `material?`, `purchaseUrl?` sur `Molding` |
| `src/types/schemas.ts` | Étendre le schéma de validation pour les nouveaux champs |
| `src/state/defaults.ts` | Valeurs par défaut : `material: undefined`, `purchaseUrl: undefined` |
| `src/ui/MoldingsPanel.ts` | Bouton import, champ `purchaseUrl`, boutons 🛒/🔍, dropdown matériau |
| `src/ui/ImportModal.ts` | **Nouveau** — modal paste + extraction Gemini |
| `src/ui/MaterialAdvisor.ts` | **Nouveau** — composant fiche expert matériau (données embarquées) |
| `src/ui/SettingsModal.ts` | **Nouveau** (refactor du modal existant) — Google Sign-In + guide clé |
| `src/services/gemini.ts` | Ajouter `extractMoldingFromText(text, url?)` → `Partial<Molding>` |
| `src/style.css` | Styles pour fiche matériau, boutons achat, profil Google |

## Ce qui ne change pas

- Flux d'ajout manuel de moulure — inchangé
- Rendu canvas, calcul budget, export PDF — inchangés
- Structure des projets existants — rétrocompatible (champs optionnels)
- `bindModal()` dans `index.ts` — inchangé

---

## Tests

### `gemini.ts` — `extractMoldingFromText`
- Texte avec toutes les dimensions → JSON complet retourné
- Texte partiel → champs manquants à `null`
- JSON malformé retourné par Gemini → erreur gérée, toast affiché

### `ImportModal.ts`
- Bouton "Extraire" désactivé si zone de texte vide
- Extraction réussie → formulaire pré-rempli avec les valeurs
- URL optionnelle sauvegardée dans `purchaseUrl`

### `MoldingsPanel.ts` — liens d'achat
- Moulure avec `purchaseUrl` → bouton 🛒 présent, URL correcte
- Moulure sans `purchaseUrl` → bouton 🔍, URL Amazon générée avec le nom et les dimensions

### `MaterialAdvisor.ts`
- Chaque matériau affiche sa fiche correcte
- Matériau `other` → fiche générique

### `SettingsModal.ts`
- Sans Google Sign-In → bouton connexion visible, champ clé API disponible
- Après Sign-In → nom/email affiché, lien AI Studio visible
- Clé API sauvegardée indépendamment de la connexion Google
