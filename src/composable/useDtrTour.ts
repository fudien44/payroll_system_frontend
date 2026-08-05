import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_STORAGE_KEY = 'jopayroll_dtr_tour_completed'

const steps: DriveStep[] = [
  {
    element: '[data-tour="dtr-header"]',
    popover: {
      title: 'Daily Time Record',
      description: 'Monitor biometric device status and manage employee DTR for the pay period from this screen.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="calendar-reminder"]',
    popover: {
      title: 'Check the Calendar First',
      description: 'Set holidays and suspensions in the Calendar module before saving — missing entries will require an Override to fix later.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="save-dtr"]',
    popover: {
      title: 'Save DTR',
      description: 'Computes and saves DTR summaries for all employees. A 3-minute cooldown applies before you can save again.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="set-flexi"]',
    popover: {
      title: 'Set Flexi Schedule',
      description: 'Assign flexible schedules to employees whose hours don\u2019t follow the standard shift.',
      side: 'bottom', align: 'end',
    },
  },
  {
    element: '[data-tour="stats-cards"]',
    popover: {
      title: 'Quick Stats',
      description: 'Total employees, plus how many biometric devices are online or offline right now.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="biometric-devices"]',
    popover: {
      title: 'Biometric Devices',
      description: 'Live status per location. If a device shows offline, time logs won\u2019t sync from that site.',
      side: 'bottom', align: 'start',
    },
  },
  {
    element: '[data-tour="employee-search"]',
    popover: {
      title: 'Search Employees',
      description: 'Filter the list by name, position, division, or section.',
      side: 'left', align: 'start',
    },
  },
  {
    element: '[data-tour="dtr-status-column"]',
    popover: {
      title: 'DTR Status',
      description: 'Shows whether an employee\u2019s DTR is Saved, Overridden, or Pending for the period.',
      side: 'left', align: 'start',
    },
  },
  {
    element: '[data-tour="dtr-actions"]',
    popover: {
      title: 'View / Edit DTR',
      description: 'Opens the employee\u2019s detailed daily time record for review or edits.',
      side: 'left', align: 'start',
    },
  },
]

export function useDtrTour() {
  let driverObj: Driver | null = null

  function getDriver(): Driver {
    if (!driverObj) {
      driverObj = driver({
        showProgress: true,
        allowClose: true,
        overlayColor: 'rgba(0,0,0,0.6)',
        popoverClass: 'jo-tour-popover',
        steps,
        onDestroyed: () => localStorage.setItem(TOUR_STORAGE_KEY, 'true'),
      })
    }
    return driverObj
  }

  function startTour() {
    getDriver().drive()
  }

  function maybeAutoStartTour() {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      // wait for table/cards to render before measuring positions
      setTimeout(() => startTour(), 500)
    }
  }

  function resetTourFlag() {
    localStorage.removeItem(TOUR_STORAGE_KEY)
  }

  return { startTour, maybeAutoStartTour, resetTourFlag }
}
