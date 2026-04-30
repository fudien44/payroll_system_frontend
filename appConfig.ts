import { config } from '@/composable/useConfig'

// default settings
export const appConfig = config({
  title: ref('JO Payroll System'),
  theme: ref('system'),
  navigationMenu: ref('vertical'), // horizontal or vertical
  isBoxLayout: ref(true),
  isVerticalMenuMini: ref(false),
  defaultLocale: ref('en'), // en | fr | ar
  isRtl: ref(false),
  isSemiDark: ref(false),
  skins: ref('modern'), // classic | modern | decent | bordered
  isNavbarFixed: ref(true),
  routeTransition: ref('fade-transition'), // choose `none` to disable the route transition or  'slide-x-transition' | 'slide-x-reverse-transition' | 'fade-transition' | 'scroll-x-transition' | 'scroll-x-reverse-transition'
})
