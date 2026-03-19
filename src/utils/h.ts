// src/utils/h.ts — escape HTML pour les rares cas d'innerHTML restants (modals)
const MAP: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}
export const h = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, c => MAP[c]!)
