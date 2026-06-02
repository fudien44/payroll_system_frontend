export default [
  { heading: 'Dashboard' },
  {
    name: 'Home',
    icon: 'mdi-view-dashboard-outline',
    to: { name: 'home' },
  },
  { heading: 'Payroll' },
  {
    name: 'Payroll',
    icon: 'mdi-cash-multiple',
    to: { name: 'payroll' },
  },
  { heading: 'Management' },
  {
    name: 'DTR',
    icon: 'mdi mdi-fingerprint',
    to: { name: 'DTR' },
  },
  {
    name: 'Calendar',
    icon: 'mdi-calendar-month-outline',
    to: { name: 'CalendarManagement' },
  },
  {
    name: 'Deductions',
    icon: 'mdi-minus-box-outline',
    to: { name: 'Deductions' },
  },
  { heading: 'Configuration' },
  {
    name: 'Signatories',
    icon: 'mdi-file-sign',
    to: { name: 'Signatories' },
  },
  { heading: 'References' },
  {
    name: 'ENGAS (Viewing Only)',
    icon: 'mdi-database-search-outline',
    to: { name: 'Engas' },
  },
];
