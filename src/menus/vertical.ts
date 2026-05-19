export default [
  { heading: 'Main Menu' },
  {
    name: 'Home',
    icon: 'mdi-view-dashboard-outline',
    to: { name: 'home' },
  },
  { heading: 'Management'},
  {
    name: 'Payroll',
    icon: 'mdi-cash-multiple',
    to: { name: 'payroll' },
  },
  // {
  //   name: 'Employees',
  //   icon: 'mdi-account-group-outline',
  //   to: { name: 'employees' },
  // },
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
    name: 'ENGAS',
    icon: 'mdi-database-search-outline',
    to: { name: 'Engas' },
  },
  // {
  //   name: 'Blank Page',
  //   icon: 'mdi-file-outline',
  //   to: { name: 'blank' },
  // },
  // { name: 'Documentation', icon: 'mdi-text-box-outline', href: 'https://docs.icreatorstudio.com/', target: '_blank' },
];
