# Calendar Management — Integration Guide

A payroll-aware calendar feature for PrimeDash (PrimeVue + TypeScript).

## Files

| File | Drop into |
|---|---|
| `usePayrollCalendar.ts` | `src/composables/` |
| `CalendarManagement.vue` | `src/views/` (or `src/pages/`) |

---

## 1. Copy the files

```bash
cp usePayrollCalendar.ts  your-project/src/composables/
cp CalendarManagement.vue your-project/src/views/
```

---

## 2. Register the route

In your router file (e.g. `src/router/index.ts`):

```ts
{
  path: '/calendar',
  name: 'CalendarManagement',
  component: () => import('@/views/CalendarManagement.vue'),
  meta: { title: 'Calendar Management' },
}
```

Add a nav link in your sidebar/menu:

```ts
{ label: 'Calendar', icon: 'pi pi-calendar', to: '/calendar' }
```

---

## 3. PrimeVue version notes

| PrimeVue version | Calendar component | Import |
|---|---|---|
| **v3** | `<Calendar>` | `import Calendar from 'primevue/calendar'` |
| **v4** | `<DatePicker>` | `import DatePicker from 'primevue/datepicker'` |

The component ships with `<Calendar>` (v3). To upgrade to v4, find-replace in
`CalendarManagement.vue`:
- Component import: `primevue/calendar` → `primevue/datepicker`
- Template tag: `<Calendar` / `</Calendar>` → `<DatePicker` / `</DatePicker>`

---

## 4. Required PrimeVue components (auto-imported or manual)

If you're **not** using `unplugin-vue-components` / auto-imports, register globally
or import per-component:

```ts
// main.ts
import Calendar  from 'primevue/calendar'
import Dialog    from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message   from 'primevue/message'
import Tag       from 'primevue/tag'
import Button    from 'primevue/button'

app.component('Calendar',  Calendar)
app.component('Dialog',    Dialog)
app.component('InputText', InputText)
app.component('Message',   Message)
app.component('Tag',       Tag)
app.component('Button',    Button)
```

---

## 5. Features at a glance

### Calendar Grid
- Full month view with custom day cells
- Navigate months with ‹ › arrows
- Color-coded cells:
  - 🔴 Red background = Regular Holiday
  - 🟡 Yellow background = Special Holiday
  - 🟢 Green background = Suspension Day
  - Blue outline = Today
- Click any day to pre-fill the Add Suspension dialog for that date

### Month Summary Sidebar
- Counts for Regular Holidays, Special Holidays, and Suspensions
- Listed names for each holiday in the month
- Suspension day list with delete confirmation

### Add Suspension Day
- Date picker restricted to the current viewed month
- Label / reason field (max 120 chars)
- Duplicate date validation
- Press Enter to submit

---

## 6. Updating holidays

Edit `PH_HOLIDAYS` in `usePayrollCalendar.ts`. Each entry needs:

```ts
{ date: 'YYYY-MM-DD', label: 'Holiday Name', type: 'regular' | 'special' }
```

Variable holidays (Maundy Thursday, Good Friday, Black Saturday, Chinese New
Year, National Heroes Day) must be computed or entered manually per year.

---

## 7. Persisting suspension days (future)

Right now suspensions live in reactive state (lost on refresh). To persist:

**LocalStorage** — add watchers in the composable:
```ts
import { watch } from 'vue'
watch(suspensionDays, (v) => localStorage.setItem('suspensions', JSON.stringify(v)), { deep: true })
// and load on init:
const stored = localStorage.getItem('suspensions')
if (stored) suspensionDays.value = JSON.parse(stored)
```

**REST API** — replace `addSuspensionDay` / `removeSuspensionDay` with API calls
and swap the ref for an async data fetch (e.g. via `useAsyncState` from VueUse).
