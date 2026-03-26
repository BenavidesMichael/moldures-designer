# Design — Guide d'achat de moulures & Import Gemini

**Date :** 2026-03-26
**Projet :** Moldures Designer
**Statut :** Approuvé

---

## Objectif

Faciliter l'achat de moulures en ligne en ajoutant quatre capacités complémentaires à l'application :

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
| `showSettingsModal()` dans `index.ts` | Modal settings implémenté en ligne via `innerHTML` — contient un sélecteur de modèle (`geminiModel`) et un champ clé API |
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

interface MaterialInfo {
  label: string
  icon: string
  pros: string[]
  notes: string[]
  priceRange: string
  idealFor: string
}

interface Molding {
  // ... champs existants inchangés ...
  material?: MoldingMaterial  // type de matériau
  purchaseUrl?: string        // lien d'achat valide (https:// ou http:// uniquement)
}
```

Les anciens projets sans ces champs sont traités comme `undefined` — aucune migration nécessaire. Les champs étant optionnels en TypeScript, `DEFAULT_MOLDING` dans `defaults.ts` n'a pas besoin de les mentionner.

**Validation `purchaseUrl` :** le champ n'accepte que les URLs à protocole `https://` ou `http://`. Toute valeur à protocole non reconnu (ex. `javascript:`, `data:`) est rejetée à la saisie. Le schéma Zod utilise `z.string().url().refine(u => /^https?:\/\//i.test(u)).optional()`.

`MoldingMaterial` est un type alias TypeScript (union de chaînes) — il n'existe pas à l'exécution. Le schéma Zod correspondant utilise donc `z.enum([...literal values...])` et non `z.nativeEnum()`.

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
4. **Transition modale :** en cas d'extraction réussie, `ImportModal` appelle directement `showMoldingModal(prefilled)`, ce qui remplace le contenu de `#modal-content` sans fermer le modal. Aucun événement de fermeture intermédiaire n'est déclenché.
5. Le formulaire standard s'affiche pré-rempli avec les données extraites + l'URL stockée comme `purchaseUrl`
6. L'utilisateur corrige si nécessaire, puis enregistre

**Champ `color` :** non extrait (impossible depuis un texte produit) — pré-rempli avec la valeur par défaut `#e8d5b0`, modifiable manuellement.

#### Type intermédiaire d'extraction

```typescript
interface ExtractedMolding {
  name: string | null
  material: MoldingMaterial | null
  width: number | null        // largeur visible en mm
  thickness: number | null    // épaisseur en mm
  barLength: number | null    // longueur d'une barre en cm
  pricePerBar: number | null  // prix unitaire en euros
  reference: string | null    // référence produit
}
```

`extractMoldingFromText` retourne `Partial<Molding>` : les champs `null` sont supprimés avant le retour via `Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null))`.

#### Signature du service

```typescript
// src/services/gemini.ts
export async function extractMoldingFromText(
  text: string,
  url?: string,
): Promise<Partial<Molding>>
```

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
  "width": number | null,
  "thickness": number | null,
  "barLength": number | null,
  "pricePerBar": number | null,
  "reference": string | null
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

Validation à la saisie : si le protocole n'est pas `https://` ou `http://`, affichage d'un message d'erreur sous le champ et désactivation du bouton Enregistrer.

#### Dans la liste du catalogue

Chaque entrée moulure affiche l'un des deux boutons selon l'état du `purchaseUrl` :

- **`🛒 Acheter`** — si `purchaseUrl` défini → ouvre l'URL dans un nouvel onglet (`target="_blank" rel="noopener noreferrer"`)
- **`🔍 Trouver sur Amazon`** — si pas de `purchaseUrl` → génère une recherche :

```typescript
function generateAmazonSearchUrl(molding: Molding): string {
  const terms = [molding.name, molding.reference].filter(Boolean).join(' ')
  return `https://www.amazon.fr/s?k=${encodeURIComponent(terms + ' moulure')}`
}
```

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

`showSettingsModal()` dans `index.ts` est **remplacé par un import** depuis `src/ui/SettingsModal.ts` :

```typescript
// index.ts — avant
// modal settings inline via innerHTML

// index.ts — après
import { showSettingsModal } from './ui/SettingsModal.js'
```

`SettingsModal.ts` utilise `lit-html render()` dans `#modal-content`, comme tous les autres panels. Le sélecteur de modèle Gemini (`geminiModel`) existant est **conservé et intégré** dans la nouvelle UI.

#### Prérequis Google Cloud

- Un projet Google Cloud doit être créé avec un **OAuth 2.0 client ID** de type "Application web"
- L'origine autorisée doit inclure `https://<username>.github.io` (pour le déploiement) et `http://localhost:5173` (dev)
- Le `client_id` est une valeur **publique** (non secrète) — elle est définie comme constante nommée dans `SettingsModal.ts` :
  ```typescript
  const GOOGLE_CLIENT_ID = '123456789-xxxx.apps.googleusercontent.com'
  ```
- `index.html` doit inclure le script GIS :
  ```html
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  ```

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
│                                          │
│  Modèle  [gemini-flash ▼]                │
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
│                                          │
│  Modèle  [gemini-flash ▼]                │
│  [Enregistrer]                           │
│                                          │
│  Pas encore de clé ?                     │
│  → Obtenir ma clé gratuite sur           │
│    aistudio.google.com — connectez-vous  │
│    avec le même compte Google            │
└──────────────────────────────────────────┘
```

#### Comportements d'erreur GIS

- Popup Sign-In annulée par l'utilisateur → aucun changement d'état, bouton reste visible
- Script GIS indisponible (erreur réseau, bloqueur de pub) → bouton "Se connecter avec Google" masqué silencieusement ; le champ clé API reste pleinement fonctionnel, aucune fonctionnalité n'est bloquée
- Token expiré → retour à l'état "non connecté" au prochain chargement

#### Garanties

- La clé API reste stockée dans `localStorage` comme aujourd'hui — la connexion Google est entièrement optionnelle
- Sans connexion Google, toutes les fonctionnalités fonctionnent exactement comme avant
- Aucune donnée utilisateur n'est envoyée à un serveur tiers par l'application

---

## Architecture — fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/types/index.ts` | Ajouter `MoldingMaterial`, `MaterialInfo`, `ExtractedMolding`, `material?`, `purchaseUrl?` sur `Molding` |
| `src/types/schemas.ts` | Étendre le schéma Zod : `material: z.enum(['wood','mdf','pvc','polystyrene','polyurethane','other']).optional()`, `purchaseUrl: z.string().url().refine(u => /^https?:\/\//i.test(u)).optional()` |
| `src/ui/MoldingsPanel.ts` | Bouton import, champ `purchaseUrl` validé, boutons 🛒/🔍, dropdown matériau |
| `src/ui/ImportModal.ts` | **Nouveau** — modal paste + extraction Gemini + transition vers formulaire moulure |
| `src/ui/MaterialAdvisor.ts` | **Nouveau** — composant fiche expert matériau (données embarquées, `MATERIAL_INFO`) |
| `src/ui/SettingsModal.ts` | **Nouveau** — remplace `showSettingsModal()` inline dans `index.ts` ; conserve le sélecteur de modèle Gemini ; ajoute Google Sign-In |
| `src/index.ts` | Remplacer le modal settings inline par `import { showSettingsModal } from './ui/SettingsModal.js'` + ajouter `<script>` GIS dans `index.html` |
| `src/services/gemini.ts` | Ajouter `extractMoldingFromText(text, url?)` → `Promise<Partial<Molding>>` |
| `src/style.css` | Styles pour fiche matériau, boutons achat, profil Google |
| `index.html` | Ajouter `<script src="https://accounts.google.com/gsi/client" async defer></script>` |

## Ce qui ne change pas

- Flux d'ajout manuel de moulure — inchangé
- Rendu canvas, calcul budget, export PDF — inchangés
- Structure des projets existants — rétrocompatible (champs optionnels)
- `bindModal()` dans `index.ts` — inchangé
- Sélecteur de modèle Gemini — conservé dans `SettingsModal.ts`

---

## Tests

### `gemini.ts` — `extractMoldingFromText`
- Texte avec toutes les dimensions → `Partial<Molding>` complet retourné (sans champs null)
- Texte partiel → seuls les champs trouvés présents dans le retour
- JSON malformé retourné par Gemini → `Promise` rejetée, toast "Extraction échouée" affiché par l'appelant

### `ImportModal.ts`
- Bouton "Extraire" désactivé si zone de texte vide
- Extraction réussie → `showMoldingModal(prefilled)` appelé, formulaire pré-rempli visible dans `#modal-content`
- URL optionnelle valide (`https://`) → sauvegardée dans `purchaseUrl`
- URL à protocole invalide (`javascript:…`) → message d'erreur inline sur le champ ; l'extraction Gemini n'est **pas** bloquée (le champ est optionnel) ; l'URL invalide n'est simplement pas stockée

### `MoldingsPanel.ts` — liens d'achat
- Moulure avec `purchaseUrl` valide → bouton 🛒 présent, `href` correspond à l'URL stockée
- Moulure sans `purchaseUrl` → bouton 🔍, URL Amazon générée avec le nom et la référence produit
- Moulure avec `purchaseUrl` invalide (protocole non `https?`) → bouton 🛒 non rendu

### `MaterialAdvisor.ts`
- Chaque matériau (wood, mdf, pvc, polystyrene, polyurethane) affiche sa fiche correcte
- Matériau `other` → fiche générique affichée

### `SettingsModal.ts`
- Sans Google Sign-In → bouton connexion visible, champ clé API et sélecteur de modèle disponibles
- Après Sign-In → nom/email affiché, lien AI Studio visible
- Clé API sauvegardée indépendamment de la connexion Google
- Sélecteur de modèle Gemini → valeur correctement sauvegardée dans `localStorage`
- GIS indisponible → bouton connexion masqué, clé API fonctionnelle sans interruption
