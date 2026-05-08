import { useEffect, useState } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

export interface NetworkStatus {
  isConnected:    boolean
  isInternetReachable: boolean | null
  type:           string
}

/**
 * Tracks real-time network state.
 * isConnected = device has a network connection
 * isInternetReachable = can actually reach the internet (null = unknown)
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected:         true,
    isInternetReachable: null,
    type:                'unknown',
  })

  useEffect(() => {
    // Fetch current state immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      setStatus({
        isConnected:         state.isConnected         ?? true,
        isInternetReachable: state.isInternetReachable ?? null,
        type:                state.type,
      })
    })

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected:         state.isConnected         ?? true,
        isInternetReachable: state.isInternetReachable ?? null,
        type:                state.type,
      })
    })

    return () => unsubscribe()
  }, [])

  return status
}

/**
 * Returns true when we know the device is offline.
 * Treats null isInternetReachable as online (fail open).
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkStatus()
  return !isConnected || isInternetReachable === false
}