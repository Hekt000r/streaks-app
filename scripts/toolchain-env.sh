#!/usr/bin/env bash
# Optional helper for the per-user tools installed during local validation.
# Usage: source scripts/toolchain-env.sh
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo 'Use: source scripts/toolchain-env.sh' >&2
  exit 1
fi
STREAKS_TOOLCHAIN_ROOT="${STREAKS_TOOLCHAIN_ROOT:-${XDG_DATA_HOME:-$HOME/.local/share}/streaks-toolchain}"
if [[ ! -x "$STREAKS_TOOLCHAIN_ROOT/jdk17/bin/java" || ! -x "$STREAKS_TOOLCHAIN_ROOT/node22/bin/node" || ! -d "$STREAKS_TOOLCHAIN_ROOT/android-sdk" ]]; then
  echo 'Local Streaks toolchain not found. Use your own Node 22, JDK 17, and ANDROID_HOME instead.' >&2
  return 1
fi
export JAVA_HOME="$STREAKS_TOOLCHAIN_ROOT/jdk17"
export ANDROID_HOME="$STREAKS_TOOLCHAIN_ROOT/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$STREAKS_TOOLCHAIN_ROOT/node22/bin:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
