export interface ToastAction {
  label: string
  onClick: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(
  message: string,
  type: 'success' | 'error' = 'success',
  action?: ToastAction,
): void {
  const el = document.getElementById('app-toast')
  if (!el) return

  el.innerHTML = ''   // vide le contenu précédent

  const span = document.createElement('span')
  span.className = 'toast-msg'
  span.textContent = message  // textContent — XSS-safe
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
