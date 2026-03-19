# Dialogs Design — Remplacement de `prompt()` / `confirm()`

**Date :** 2026-03-18
**Projet :** Moldures Designer
**Statut :** Approuvé

---

## Objectif

Remplacer tous les `prompt()` et `confirm()` natifs du navigateur par des interactions cohérentes avec le système de modal custom (`#app-modal`) et le système de toast (`showToast`) déjà présents dans l'application.

> **Note d'implémentation :** Le plan existant (`2026-03-18-moldures-designer.md`) contient encore les appels natifs dans les tasks 12, 13 et 14. Le plan d'implémentation produit par ce spec est un **amendement** qui remplace ces sections. Un développeur doit appliquer ce plan APRÈS avoir implémenté les tasks d'origine, ou en remplacement des sections concernées.

---

## Contexte existant

| Élément | Description |
|---------|-------------|
| `#app-modal` | Modal custom, ouvert/fermé via `classList`. Contenu rendu avec lit-html `render()` dans `#modal-content`. Fermé globalement par ✕ (`modal-close`) ou clic backdrop dans `bindModal()`. |
| `showToast(msg, type)` | Toast texte seulement, 2.5s, type `'success'` ou `'error'`. Utilise `el.textContent`. |
| `undo()` / `redo()` | Exposés depuis `AppState.ts`, déclenchés par Ctrl+Z / Ctrl+Y. Reviennent à l'état immer complet, incluant `activeWallId`. |

### Occurrences à remplacer

| Fichier | Fonction | Dialog natif | Remplacement |
|---------|----------|-------------|--------------|
| `ProjectPanel.ts` | `addWall()` | `prompt()` nom | `showInputModal` |
| `ProjectPanel.ts` | `renameWall()` | `prompt()` nom | `showInputModal` |
| `ProjectPanel.ts` | `deleteWall()` | `confirm()` | toast + Annuler → `undo()` |
| `ProjectPanel.ts` | `resetProject()` | `confirm()` | modal confirm danger |
| `MoldingsPanel.ts` | `addRosette()` | 3× `prompt()` | `showRosetteModal` |
| `MoldingsPanel.ts` | delete molding | `confirm()` | toast + Annuler → `undo()` |
| `MoldingsPanel.ts` | delete rosette | *(suppression silencieuse)* | toast + Annuler → `undo()` |

> **Rosette delete :** Actuellement sans confirmation ni toast. Aligné avec les autres suppressions : toast + Annuler.

---

## Design

### 1. Extension de `showToast` — toast avec action

`src/ui/toast.ts` — signature étendue, **rétrocompatible**.

**Approche DOM :** Le bouton est créé **impérativement** (pas d'`innerHTML` — les noms de murs/moulures viennent de l'utilisateur et peuvent contenir `<`, `"`, etc. ; pas de `render()` lit-html — toast.ts doit rester sans dépendances lourdes).

```typescript
export interface ToastAction {
  label: string
  onClick: () => void
}

export function showToast(
  message: string,
  type: 'success' | 'error' = 'success',
  action?: ToastAction,
): void {
  const el = document.getElementById('app-toast')
  if (!el) return

  // Vider le contenu précédent
  el.innerHTML = ''

  const span = document.createElement('span')
  span.className = 'toast-msg'
  span.textContent = message   // textContent — XSS-safe
  el.appendChild(span)

  if (action) {
    const btn = document.createElement('button')
    btn.className = 'toast-action'
    btn.textContent = action.label
    btn.addEventListener('click', () => {
      action.onClick()
      el.classList.remove('app-toast--visible')
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
    })
    el.appendChild(btn)
  }

  el.className = `app-toast app-toast--${type} app-toast--visible`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.classList.remove('app-toast--visible')
  }, action ? 4000 : 2500)
}
```

CSS ajouté (`.toast-action`) :
```css
.toast-action {
  margin-left: 12px;
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
```

**Comportement undo :** `undo()` revient à l'intégralité du snapshot immer précédent, incluant `activeWallId`. Pour `deleteWall`, si le mur supprimé était actif, l'undo restituera également la sélection correcte — comportement souhaité.

---

### 2. Helper `showInputModal` — saisie texte simple

**Nouveau fichier** `src/ui/modal.ts`.

**Imports :**
```typescript
import { html, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
```

**Interface :**
```typescript
export function showInputModal(
  title: string,
  initial: string,
  onSave: (value: string) => void,
): void
```

**Comportement :**
- Rend un formulaire dans `#modal-content` via lit-html `render()`
- Champ texte pré-rempli avec `initial`, focus automatique
- Bouton OK désactivé (`?disabled=${!value.trim()}`) si champ vide ou espaces seuls
- Enter key → soumet si non-vide (même effet que cliquer OK)
- Clic OK → `onSave(value.trim())` + `classList.add('hidden')` sur `#app-modal`
- Dismiss (✕, backdrop via `bindModal()`) → modal fermé, `onSave` **non appelé** — comportement correct car `bindModal()` ferme le modal sans interagir avec le callback local

**Maquette :**
```
┌─────────────────────┐
│  ✕                  │
│  Nouveau mur        │
│  ┌───────────────┐  │
│  │ Salon         │  │
│  └───────────────┘  │
│  [    OK    ]       │
└─────────────────────┘
```

---

### 3. Modal rosette — `showRosetteModal`

Fonction **privée** dans `src/ui/MoldingsPanel.ts` (pas besoin de généraliser).

**Imports :** `html`, `render` from `lit-html` — déjà présents dans `MoldingsPanel.ts`.

**Validation des champs :**
- Nom : obligatoire, non-vide (même règle que `showInputModal`)
- Taille : nombre > 0 (valeur par défaut 20.5)
- Prix : nombre ≥ 0 (0 autorisé — rosette offerte), valeur par défaut 9.68
- Bouton Enregistrer désactivé si nom vide OU taille ≤ 0

**Comportement :**
- Rendu dans `#modal-content` via `render()`
- Création rosette avec `nanoid()`, `setState`, ferme modal

**Maquette :**
```
┌─────────────────────────┐
│  ✕                      │
│  Nouvelle rosette       │
│  Nom      [___________] │
│  Taille   [_20.5_] cm   │
│  Prix     [_9.68_] €    │
│  [    Enregistrer    ]  │
└─────────────────────────┘
```

---

### 4. Modal confirmation — reset projet

Fonction **privée** dans `src/ui/ProjectPanel.ts`.

**Imports :** `html`, `render` from `lit-html` — déjà présents.

**Comportement :**
- Rendu dans `#modal-content` via `render()`
- Bouton "Réinitialiser" (classe `danger`) → reset + ferme modal + `showToast('🔄 Projet réinitialisé')`
- Bouton "Annuler" (neutre) → ferme modal uniquement
- Dismiss (✕, backdrop) → ferme modal, reset **non exécuté**

**Maquette :**
```
┌─────────────────────────────────┐
│  ✕                              │
│  ⚠ Réinitialiser le projet ?    │
│                                 │
│  Toutes les données seront      │
│  perdues. Cette action peut     │
│  être annulée avec Ctrl+Z.      │
│                                 │
│  [Annuler]  [Réinitialiser →]   │
└─────────────────────────────────┘
```

---

## Architecture — fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/ui/toast.ts` | Ajouter `ToastAction`, paramètre `action?`, construction DOM impérative |
| `src/ui/modal.ts` | **Nouveau** — `showInputModal()` |
| `src/ui/ProjectPanel.ts` | `addWall`, `renameWall` → `showInputModal` ; `deleteWall` → toast+undo ; `resetProject` → modal confirm |
| `src/ui/MoldingsPanel.ts` | `addRosette` → `showRosetteModal` ; delete molding → toast+undo ; delete rosette → toast+undo |
| `src/style.css` | Ajouter `.toast-action` |

## Ce qui ne change pas

- `#app-modal` HTML structure
- `bindModal()` dans `index.ts` — inchangé, gère ✕ et backdrop globalement

---

## Tests

### `toast.ts`
- Toast sans action : texte visible, disparaît après 2.5s
- Toast avec action : bouton présent, `onClick` déclenché au clic, toast fermé immédiatement
- Toast avec action : disparaît après 4s sans clic

### `modal.ts` — `showInputModal`
- Bouton OK désactivé si champ vide ou espaces seuls
- Enter soumet si non-vide, `onSave` appelé avec valeur trimée
- `onSave` non appelé si `initial` inchangé et fermeture par ✕ (simulation `classList.add('hidden')`)

### `MoldingsPanel.ts` — `showRosetteModal`
- Bouton Enregistrer désactivé si nom vide
- Bouton Enregistrer désactivé si taille = 0
- Prix = 0 accepté (bouton actif)
- `setState` appelé avec les bonnes valeurs au submit

### `ProjectPanel.ts` — modal reset
- Clic "Réinitialiser" → `setState` appelé + toast affiché
- Clic "Annuler" → `setState` non appelé
