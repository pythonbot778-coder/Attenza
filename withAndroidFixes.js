const { withAndroidManifest, withProjectBuildGradle } = require('@expo/config-plugins')

function withAndroidFixes(config) {
  // 1. AndroidManifest fix for tools:replace on notification metadata
  config = withAndroidManifest(config, async (config) => {
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

  // 2. Force androidx.core to 1.15.0 to prevent 1.17.0 compileSdk 36 error on EAS
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const resolutionSnippet = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force "androidx.core:core:1.15.0"
            force "androidx.core:core-ktx:1.15.0"
        }
    }
}
`
      if (!config.modResults.contents.includes('androidx.core:core:1.15.0')) {
        config.modResults.contents += resolutionSnippet
      }
    }
    return config
  })

  return config
}

module.exports = withAndroidFixes
