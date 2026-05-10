#!/usr/bin/env node

/**
 * Notification Health Checker
 * Verifies config consistency across app.json and notificationUtils.ts
 * 
 * Run with: node scripts/check-notifications-config.js
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '../app.json');
const notificationUtilsPath = path.join(__dirname, '../src/utils/notificationUtils.ts');

let errors = [];
let warnings = [];

console.log('\n📋 Attenza Notification Configuration Health Check\n');
console.log('═'.repeat(60));

// ─────────────────────────────────────────────────────────────
// 1. Verify app.json
// ─────────────────────────────────────────────────────────────

console.log('\n✓ Checking app.json...\n');

let appJson;
try {
  appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
} catch (e) {
  errors.push(`Failed to parse app.json: ${e.message}`);
  process.exit(1);
}

const expo = appJson.expo || {};

const checks = [
  {
    name: 'Android package name',
    value: expo.android?.package,
    expected: 'com.vindra.attenza',
  },
  {
    name: 'Google Services file',
    value: expo.android?.googleServicesFile,
    expected: './google-services.json',
  },
  {
    name: 'EAS Project ID',
    value: expo.extra?.eas?.projectId,
    expected: 'afda8a63-2555-4f78-96a7-d306ded825dc',
  },
  {
    name: 'Expo owner',
    value: expo.owner,
    expected: 'python778',
  },
];

checks.forEach(check => {
  if (check.value === check.expected) {
    console.log(`  ✓ ${check.name}: ${check.value}`);
  } else {
    errors.push(
      `${check.name}: expected "${check.expected}", got "${check.value}"`
    );
    console.log(`  ✗ ${check.name}: ${check.value} (expected: ${check.expected})`);
  }
});

// Check for expo-notifications plugin
const hasNotificationsPlugin = (expo.plugins || []).some(
  plugin =>
    (typeof plugin === 'string' && plugin === 'expo-notifications') ||
    (Array.isArray(plugin) && plugin[0] === 'expo-notifications')
);

if (hasNotificationsPlugin) {
  console.log(`  ✓ expo-notifications plugin present`);
} else {
  errors.push('expo-notifications plugin not found in app.json');
  console.log(`  ✗ expo-notifications plugin not found`);
}

// ─────────────────────────────────────────────────────────────
// 2. Verify notificationUtils.ts
// ─────────────────────────────────────────────────────────────

console.log('\n✓ Checking notificationUtils.ts...\n');

let notificationUtils;
try {
  notificationUtils = fs.readFileSync(notificationUtilsPath, 'utf8');
} catch (e) {
  errors.push(`Failed to read notificationUtils.ts: ${e.message}`);
  process.exit(1);
}

const notificationChecks = [
  {
    name: 'getExpoPushTokenAsync uses correct projectId',
    pattern: /getExpoPushTokenAsync\s*\(\s*\{\s*projectId:\s*['"]afda8a63-2555-4f78-96a7-d306ded825dc['"]/,
  },
  {
    name: 'setNotificationChannelAsync called with "attenza"',
    pattern: /setNotificationChannelAsync\s*\(\s*['"]attenza['"]/,
  },
  {
    name: 'Android importance set to HIGH',
    pattern: /importance:\s*Notifications\.AndroidImportance\.HIGH/,
  },
  {
    name: 'Notification channel uses sound: "default"',
    pattern: /sound:\s*['"]default['"]/,
  },
  {
    name: 'channelId set to "attenza" in messages',
    pattern: /channelId:\s*['"]attenza['"]/,
  },
  {
    name: 'android.channelId set to "attenza"',
    pattern: /android:\s*\{[^}]*channelId:\s*['"]attenza['"]/,
  },
];

notificationChecks.forEach(check => {
  if (check.pattern.test(notificationUtils)) {
    console.log(`  ✓ ${check.name}`);
  } else {
    errors.push(check.name);
    console.log(`  ✗ ${check.name}`);
  }
});

// Cross-check: projectId consistency
const appJsonProjectId = expo.extra?.eas?.projectId;
const notificationUtilsProjectId = notificationUtils.match(
  /getExpoPushTokenAsync\s*\(\s*\{\s*projectId:\s*['"]([^'"]+)['"]/
)?.[1];

console.log('\n✓ Checking consistency...\n');

if (appJsonProjectId === notificationUtilsProjectId) {
  console.log(`  ✓ Project IDs match: ${appJsonProjectId}`);
} else {
  errors.push(
    `Project ID mismatch: app.json has "${appJsonProjectId}", notificationUtils.ts has "${notificationUtilsProjectId}"`
  );
  console.log(
    `  ✗ Project IDs differ:\n    app.json: ${appJsonProjectId}\n    notificationUtils.ts: ${notificationUtilsProjectId}`
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Summary
// ─────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));

if (errors.length === 0) {
  console.log('\n✅ All checks passed!\n');
  process.exit(0);
} else {
  console.log(`\n❌ Found ${errors.length} issue(s):\n`);
  errors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err}`);
  });
  console.log();
  process.exit(1);
}
