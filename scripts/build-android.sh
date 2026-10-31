#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for required in node java keytool; do
  command -v "$required" >/dev/null || { echo "Missing $required. Install Node 22 and JDK 17 first." >&2; exit 1; }
done
if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  echo 'Set ANDROID_HOME to an installed Android SDK (platform 36 and build tools).' >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo 'Run npm install and npx expo install --check first.' >&2
  exit 1
fi
if [[ -z "${STREAKS_KEYSTORE:-}" ]]; then
  mkdir -p .signing
  chmod 700 .signing
  if [[ ! -f .signing/credentials.env ]]; then
    umask 077
    STREAKS_GENERATED_PASSWORD="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
    export STREAKS_GENERATED_PASSWORD
    keytool -genkeypair -v -keystore "$PWD/.signing/streaks-release.jks" \
      -alias streaks -keyalg RSA -keysize 3072 -validity 10000 \
      -storepass:env STREAKS_GENERATED_PASSWORD -keypass:env STREAKS_GENERATED_PASSWORD \
      -dname 'CN=Streaks Personal, O=Personal, C=PL'
    printf 'export STREAKS_STORE_PASSWORD=%q\nexport STREAKS_KEY_PASSWORD=%q\nexport STREAKS_KEY_ALIAS=streaks\n' \
      "$STREAKS_GENERATED_PASSWORD" "$STREAKS_GENERATED_PASSWORD" > .signing/credentials.env
    unset STREAKS_GENERATED_PASSWORD
  fi
  source .signing/credentials.env
  export STREAKS_KEYSTORE="$PWD/.signing/streaks-release.jks"
fi
npm run check
npm run test:ui
npx expo prebuild --platform android --no-install
(cd android && ./gradlew :streak-engine:testDebugUnitTest :app:assembleRelease \
  "--max-workers=${STREAKS_GRADLE_WORKERS:-2}" --no-parallel \
  "-Dorg.gradle.jvmargs=${STREAKS_GRADLE_JVMARGS:--Xmx2048m -XX:MaxMetaspaceSize=1024m}" \
  -Pkotlin.compiler.execution.strategy=in-process "$@")
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/streaks.apk
node <<'JS'
const fs = require('node:fs');
const crypto = require('node:crypto');
fs.chmodSync('dist/streaks.apk', 0o644);
const hash = crypto.createHash('sha256').update(fs.readFileSync('dist/streaks.apk')).digest('hex');
fs.writeFileSync('dist/streaks.apk.sha256', `${hash}  streaks.apk\n`);
JS
echo 'APK: dist/streaks.apk. Back up .signing securely; the same key is required for updates.'
