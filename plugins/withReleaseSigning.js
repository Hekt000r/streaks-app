const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, config => {
    const marker = '// STREAKS_RELEASE_SIGNING';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `
${marker}
def streaksKey = System.getenv('STREAKS_KEYSTORE')
def streaksPass = System.getenv('STREAKS_STORE_PASSWORD')
def streaksAlias = System.getenv('STREAKS_KEY_ALIAS')
def streaksKeyPass = System.getenv('STREAKS_KEY_PASSWORD')
if (streaksKey && streaksPass && streaksAlias && streaksKeyPass) {
    android {
        signingConfigs {
            streaksRelease {
                storeFile file(streaksKey)
                storePassword streaksPass
                keyAlias streaksAlias
                keyPassword streaksKeyPass
            }
        }
        buildTypes { release { signingConfig signingConfigs.streaksRelease } }
    }
} else {
    gradle.taskGraph.whenReady { graph ->
        if (graph.allTasks.any { it.name.toLowerCase().contains('release') }) {
            throw new GradleException('Release signing is required. Run npm run build:apk or configure STREAKS_KEYSTORE, STREAKS_STORE_PASSWORD, STREAKS_KEY_ALIAS, STREAKS_KEY_PASSWORD.')
        }
    }
}
`;
    }
    return config;
  });
};
