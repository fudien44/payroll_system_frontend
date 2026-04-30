import { useRoute } from 'vue-router'
import type { HorizontalMenuItem, VerticalMenuItem } from './types'

type MenuItem = HorizontalMenuItem | VerticalMenuItem

export const isAnyChildActive = (item: MenuItem): boolean => {
  const route = useRoute()

  if (!item.children)
    return false

  return item.children.some((child: MenuItem) => {
    if (child.to)
      return child.to.name === route.name

    if ('children' in child && child.children)
      return isAnyChildActive(child)

    return false
  })
}

export const isNavLinkActive = (item: MenuItem): boolean => {
  const route = useRoute()

  if (item.to)
    return item.to.name === route.name

  return false
}

export const isGroupActive = (navList: MenuItem[]): string[] => {
  const activeGroup: string[] = ['']

  if (navList) {
    navList.forEach((item: MenuItem) => {
      if ('children' in item && item.children && isAnyChildActive(item))
        activeGroup.push(item.name)
    })
  }

  return activeGroup
}
