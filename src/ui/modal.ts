import { html, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'

export function showInputModal(
  title: string,
  initial: string,
  onSave: (value: string) => void,
): void {
  const content = document.getElementById('modal-content')
  const modal   = document.getElementById('app-modal')
  if (!content || !modal) return

  let value = initial

  const close = () => modal.classList.add('hidden')

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSave(trimmed)
    close()
  }

  const renderTpl = () => render(html`
    <div style="min-width:240px">
      <h3 style="margin-bottom:12px">${title}</h3>
      <input
        id="modal-input"
        type="text"
        .value=${live(value)}
        style="width:100%"
        @input=${(e: Event) => { value = (e.target as HTMLInputElement).value; renderTpl() }}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') submit() }}
        autofocus
      />
      <button
        id="modal-ok"
        class="primary"
        style="width:100%;margin-top:10px"
        ?disabled=${!value.trim()}
        @click=${submit}
      >OK</button>
    </div>
  `, content)

  renderTpl()
  modal.classList.remove('hidden')
}
