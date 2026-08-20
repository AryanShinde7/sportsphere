import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return 'http://localhost:5000/api';
  }
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000/api`;
  }
  // Default LAN IP fallback
  return 'http://10.175.233.47:5000/api';
};

export const API_URL = getApiUrl();

export const Storage = {
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage set error:', e);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val) return val;
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('Storage get error:', e);
      return null;
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage remove error:', e);
    }
  },
};
