import axios from '@axios'

const cache   = reactive<Record<string, string>>({})
const failed  = reactive<Record<string, boolean>>({})
const pending = new Set<string>()
const queue: string[] = []
let activeWorkers = 0
const MAX_CONCURRENT = 4   // NEW — cap so this never starves other requests

async function worker() {
  activeWorkers++
  while (queue.length) {
    const photoUrl = queue.shift()!
    if (cache[photoUrl] || failed[photoUrl]) continue
    pending.add(photoUrl)
    try {
      const response = await axios.get(photoUrl, { responseType: 'blob' })
      cache[photoUrl] = URL.createObjectURL(response.data)
    } catch {
      failed[photoUrl] = true
    } finally {
      pending.delete(photoUrl)
    }
  }
  activeWorkers--
}

function enqueue(photoUrl: string) {
  if (cache[photoUrl] || failed[photoUrl] || pending.has(photoUrl) || queue.includes(photoUrl)) return
  queue.push(photoUrl)
  if (activeWorkers < MAX_CONCURRENT) worker()
}

/**
 * Call from onMounted/watch — NEVER from a template expression.
 * Queues background fetches for any not-yet-cached URLs, throttled
 * to MAX_CONCURRENT at a time so it never floods the browser's
 * per-host connection limit and starves out other API requests.
 */
export function ensurePhotosLoaded(urls: (string | null | undefined)[]) {
  for (const u of urls) {
    if (u) enqueue(u)
  }
}

/**
 * Pure read — safe to call directly in templates. Does not fetch,
 * does not mutate state, just returns whatever's already cached.
 */
export function getPhoto(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null
  return cache[photoUrl] ?? null
}
