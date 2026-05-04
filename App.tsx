import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { hydrateAuthState } from './src/store/authStore'
import { RootNavigator } from './src/navigation/RootNavigator'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await hydrateAuthState()
      } catch (e) {
        console.log('boot failed', e)
      } finally {
        if (mounted) setReady(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    )
  }

  return <RootNavigator />
}