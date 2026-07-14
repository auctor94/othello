const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const PLAYER_ID_KEY = 'othello_player_id'

/** Dedupes Strict Mode double-mount so we don't POST /game twice. */
let bootstrapPromise = null

export function getOrCreatePlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

/** Shared fetch: always sends X-Player-Id for create/move/pass/get/valid-moves/stats. */
export async function fetchApi(url, options = {}) {
  const headers = new Headers(options.headers)
  headers.set('X-Player-Id', getOrCreatePlayerId())
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${API}${url}`, { ...options, headers })
}

export function fetchStats() {
  return fetchApi('/stats')
}

/**
 * Resume active game if present; otherwise create one.
 * Concurrent callers share one in-flight promise (React Strict Mode safe).
 */
export function loadOrCreateGame() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const active = await fetchApi('/game/active')
      if (active.ok) {
        return active.json()
      }
      const created = await fetchApi('/game', { method: 'POST' })
      if (!created.ok) {
        throw new Error('Failed to create game')
      }
      return created.json()
    })()
  }
  return bootstrapPromise
}

/** Call before Restart so the next loadOrCreateGame can create fresh if needed. */
export function clearGameBootstrap() {
  bootstrapPromise = null
}
