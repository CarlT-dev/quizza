import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quizza.quizza',
  appName: 'Quizza',
  webDir: 'dist',
  server: {
    url: 'https://my-quizza.web.app',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 2500,
      backgroundColor: '#2859C5',
      showSpinner: false
    },
    CapacitorUpdater: {
      appId: 'com.quizza.quizza',
      version: '0.0.0',
      defaultChannel: 'production',
      autoUpdate: 'always',
      autoSplashscreen: true
    }
  }
};

export default config;
