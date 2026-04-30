import type { IconProps } from 'vuetify'

const customIcons: Record<string, unknown> = {
  // 'mdi-checkbox-blank-outline': checkboxUnchecked,
  // 'mdi-checkbox-marked': checkboxChecked,
  // 'mdi-minus-box': checkboxIndeterminate,
  // 'mdi-radiobox-marked': radioChecked,
  // 'mdi-radiobox-blank': radioUnchecked,
}

export const iconify = {
  component: (props: IconProps) => {
    // Load custom SVG directly instead of going through icon component
    if (typeof props.icon === 'string') {
      const iconComponent = customIcons[props.icon]

      if (iconComponent)
        return h(iconComponent)
    }

    return h(
      props.tag,
      {
        ...props,

        // As we are using class based icons
        class: [props.icon],

        // Remove used props from DOM rendering
        tag: undefined,
        icon: undefined,
      },
    )
  },
}

export const icons = {
  defaultSet: 'iconify',
  sets: {
    iconify,
  },
}
