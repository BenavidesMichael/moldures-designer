let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const el = document.getElementById('app-toast')
  if (!el) return
  el.textContent = message
  el.className = `app-toast app-toast--${type} app-toast--visible`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.classList.remove('app-toast--visible')
  }, 2500)
}
