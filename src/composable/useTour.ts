import { driver, type Config, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Reusable guided-tour composable wrapping driver.js.
 * Each page passes its own `tourKey` (unique id) and `steps`.
 * "Seen" state is tracked per tourKey in localStorage, purely
 * to control the "New" badge on the trigger button — the tour
 * itself is always manually triggered, never auto-shown.
 */
export function useTour(tourKey: string, steps: DriveStep[], options: Config = {}) {
  const STORAGE_PREFIX = 'jo_payroll_tour_seen_'
  const storageKey = STORAGE_PREFIX + tourKey

  const hasSeenTour = ref<boolean>(localStorage.getItem(storageKey) === '1')

  function markSeen() {
    localStorage.setItem(storageKey, '1')
    hasSeenTour.value = true
  }

  function startTour() {
    const tourInstance = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.65)',
      popoverClass: 'jo-tour-popover',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done',
      steps,
      onDestroyed: () => {
        markSeen()
      },
      ...options,
    })

    tourInstance.drive()
  }

  return {
    hasSeenTour,
    startTour,
    markSeen,
  }
}
