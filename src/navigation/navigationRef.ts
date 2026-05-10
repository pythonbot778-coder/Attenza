import { createNavigationContainerRef, CommonActions } from '@react-navigation/native'

export const navigationRef = createNavigationContainerRef()

/**
 * Navigate to any screen from outside React components
 * (e.g. from notification tap handler in notificationUtils.ts)
 */
export function navigateTo(name: string, params?: Record<string, any>) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.navigate({ name, params })
    )
  }
}