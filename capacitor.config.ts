import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quizza.app',
  appName: 'Quizza',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2500,
      backgroundColor: '#2859C5',
      showSpinner: false
    }
  }
};



export default config;

