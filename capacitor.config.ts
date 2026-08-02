import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ceilibrisbane.app',
  appName: 'Brisbane Céilí',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#faf9f7',
  },
};

export default config;
