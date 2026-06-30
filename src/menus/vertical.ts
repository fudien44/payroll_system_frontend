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
    to: { name: 'payroll-runs' },
  },
  // {
  //   name: 'Payroll Runs',
  //   icon: 'mdi-file-document-multiple-outline',
  //   to: { name: 'payroll-runs' },
  // },
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
  {
    name: 'Reports',
    icon: 'mdi mdi-file-chart-outline',
    to: { name: 'Reports' },
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
