import { usePreferredColorScheme } from '@vueuse/core'
import { useTheme } from 'vuetify'
import { appConfig } from '@appConfig'

export const useAppConfig = () => {
  const vuetifyTheme = useTheme()
  const preferredColor = usePreferredColorScheme()

  const navigationMenu = computed({
    get() {
      return appConfig.navigationMenu.value
    },
    set(value) {
      appConfig.navigationMenu.value = value
      localStorage.setItem('app-menu', value)
    },
  })

  const theme = computed({
    get() {
      return appConfig.theme.value
    },
    set(value) {
      if (value === 'system' && !(preferredColor.value === 'no-preference')) {
        appConfig.theme.value = 'system'
        vuetifyTheme.global.name.value = preferredColor.value
        localStorage.setItem('app-theme', 'system')
      }
      else {
        appConfig.theme.value = value
        vuetifyTheme.global.name.value = value
        localStorage.setItem('app-theme', value)
      }
    },
  })

  const skins = computed({
    get() {
      return appConfig.skins.value
    },
    set(value) {
      appConfig.skins.value = value
      localStorage.setItem('app-skins', value)
    },
  })

  const isNavbarFixed = computed({
    get() {
      return appConfig.isNavbarFixed.value
    },
    set(value) {
      appConfig.isNavbarFixed.value = value
      localStorage.setItem('app-navbar-fixed', JSON.stringify(value))
    },
  })

  const isBoxLayout = computed({
    get() {
      return appConfig.isBoxLayout.value
    },
    set(value) {
      appConfig.isBoxLayout.value = value
    },
  })

  const isVerticalMenuMini = computed({
    get() {
      return appConfig.isVerticalMenuMini.value
    },
    set(value) {
      appConfig.isVerticalMenuMini.value = value
      localStorage.setItem('app-menu-mini', JSON.stringify(value))
    },
  })

  const isRtl = computed({
    get() {
      return appConfig.isRtl.value
    },
    set(value) {
      appConfig.isRtl.value = value
    },
  })

  const isSemiDark = computed({
    get() {
      return appConfig.isSemiDark.value
    },
    set(value) {
      appConfig.isSemiDark.value = value
      localStorage.setItem('app-semi-dark', JSON.stringify(value))
    },
  })

  const initLoadingTheme = () => {
    watch(theme, () => {
      localStorage.setItem('loader-bg', vuetifyTheme.current.value.colors.surface)
      localStorage.setItem('loader-color', vuetifyTheme.current.value.colors.primary)
    }, {
      immediate: true,
    })

    // watch for system theme update
    watch([preferredColor, appConfig.theme], () => {
      if (appConfig.theme.value === 'system' && !(preferredColor.value === 'no-preference'))
        vuetifyTheme.global.name.value = preferredColor.value

      if (localStorage.getItem('app-theme') !== 'system' && !(appConfig.theme.value === 'system'))

        vuetifyTheme.global.name.value = localStorage.getItem('app-theme') || appConfig.theme.value
    }, {
      immediate: true,
    })
  }

  const rootClasses = () => {
    const classes = ref<string[]>([])

    const skinAndClasses = [
      { name: 'classic', class: 'v-theme-skins-classic' },
      { name: 'modern', class: 'v-theme-skins-modern' },
      { name: 'decent', class: 'v-theme-skins-decent' },
      { name: 'bordered', class: 'v-theme-skins-bordered v-theme-skins-decent' },
    ]

    watch([appConfig.isBoxLayout, appConfig.navigationMenu, appConfig.skins], () => {
      const layout = appConfig.isBoxLayout.value ? 'v-application-box-layout' : 'v-application-full-layout'
      const menu = appConfig.navigationMenu.value === 'horizontal' ? 'v-theme-horizontal-nav' : 'v-theme-vertical-nav'
      let skin = 'v-theme-skins-classic'

      skinAndClasses.forEach(item => {
        if (appConfig.skins.value === item.name)
          skin = item.class
      })

      classes.value = [layout, menu, skin]
    }, { deep: true, immediate: true })

    return classes
  }

  const _handleSkinChanges = () => {
    const { themes } = useTheme()

    // Create skin default color so that we can revert back to original (default skin) color when switch to default skin from bordered skin
    Object.values(themes.value).forEach(t => {
      t.colors['skin-default-background'] = t.colors.background
      t.colors['skin-default-surface'] = t.colors.surface
    })

    watch(
      useAppConfig().skins,
      skin => {
        Object.values(themes.value).forEach(t => {
          t.colors.background = t.colors[`skin-${skin}-background`]
          t.colors.surface = t.colors[`skin-${skin}-surface`]
        })
      },
      { immediate: true },
    )
  }

  return {
    navigationMenu,
    theme,
    isBoxLayout,
    isVerticalMenuMini,
    isRtl,
    isSemiDark,
    skins,
    isNavbarFixed,
    initLoadingTheme,
    rootClasses,
    _handleSkinChanges,
  }
}
