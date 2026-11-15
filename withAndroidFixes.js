const { withAndroidManifest } = require('@expo/config-plugins')

function withAndroidFixes(config) {
  // AndroidManifest fix for tools:replace on notification metadata
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults
    const app = manifest.manifest.application?.[0]

    if (app && app['meta-data']) {
      app['meta-data'] = app['meta-data'].map((item) => {
        const name = item.$['android:name']
        if (
          name === 'com.google.firebase.messaging.default_notification_channel_id' ||
          name === 'com.google.firebase.messaging.default_notification_color'
        ) {
          item.$['tools:replace'] = 'android:value,android:resource'
        }
        return item
      })
    }

    manifest.manifest.$ = manifest.manifest.$ || {}
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'

    return config
  })
}

module.exports = withAndroidFixes
