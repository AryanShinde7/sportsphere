import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location?.hostname || 'localhost';
    return `http://${host}:5000/api`;
  }

  // 1. Automatically detect Metro host IP (matches whatever Wi-Fi network the phone is on)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).expoGoConfig?.debuggerHost;

  if (hostUri) {
    let ip = hostUri.split(':')[0];
    if ((ip === 'localhost' || ip === '127.0.0.1') && Platform.OS === 'android') {
      ip = '10.0.2.2';
    }
    return `http://${ip}:5000/api`;
  }

  // 2. Explicit environment variable override
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. Fallback to current LAN IP
  return 'http://192.168.1.10:5000/api';
};

export const API_URL = getApiUrl();
console.log('[Sportsphere] API_URL resolved to:', API_URL);

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

export const AUTH_TOKEN_KEY = 'userToken';
export const USER_DATA_KEY = 'userData';

export const getAuthToken = async (): Promise<string | null> => {
  return await Storage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = async (token: string): Promise<void> => {
  await Storage.setItem(AUTH_TOKEN_KEY, token);
};

export const getUserData = async <T = any>(): Promise<T | null> => {
  const data = await Storage.getItem(USER_DATA_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

export const setUserData = async (userData: any): Promise<void> => {
  await Storage.setItem(USER_DATA_KEY, JSON.stringify(userData));
};

export const clearAuth = async (): Promise<void> => {
  await Storage.removeItem(AUTH_TOKEN_KEY);
  await Storage.removeItem(USER_DATA_KEY);
};

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized request from mobile client. Token may be expired or missing.');
    }
    return Promise.reject(error);
  }
);

export const mobileApi = {
  auth: {
    login: async (credentials: { email: string; password: string }) => {
      const res = await apiClient.post('/auth/login', credentials);
      return res.data;
    },
    register: async (userData: {
      name: string;
      email: string;
      password: string;
      role?: 'ATHLETE' | 'SUPPORTER' | 'SPONSOR';
      phone?: string;
      sportId?: number;
      discipline?: string;
      city?: string;
      state?: string;
      headline?: string;
      bio?: string;
      currentGoal?: string;
    }) => {
      const res = await apiClient.post('/auth/register', userData);
      return res.data;
    },
    getMe: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
  },

  sports: {
    getAll: async () => {
      const res = await apiClient.get('/sports');
      return res.data;
    },
    create: async (name: string, category: string = 'Custom Sport') => {
      const res = await apiClient.post('/sports', { name, category });
      return res.data;
    },
  },

  user: {
    updateProfile: async (data: {
      name?: string;
      phone?: string;
      profileImageUrl?: string;
      organizationName?: string;
      organizationType?: string;
      budgetRange?: string;
    }) => {
      const res = await apiClient.put('/users/profile', data);
      return res.data;
    },
    getContributions: async () => {
      const res = await apiClient.get('/users/contributions');
      return res.data;
    },
  },

  athletes: {
    getAll: async (params?: { sportId?: number; verificationStatus?: string }) => {
      const res = await apiClient.get('/athletes', { params });
      return res.data;
    },
    getById: async (id: number | string) => {
      const res = await apiClient.get(`/athletes/${id}`);
      return res.data;
    },
    updateProfile: async (data: {
      name?: string;
      phone?: string;
      sportId?: number;
      sportName?: string;
      discipline?: string;
      city?: string;
      state?: string;
      headline?: string;
      bio?: string;
      currentGoal?: string;
      coachName?: string;
      academyName?: string;
    }) => {
      const res = await apiClient.put('/athletes/profile', data);
      return res.data;
    },
  },

  support: {
    getSupportRequest: async (id: number | string) => {
      const res = await apiClient.get(`/support-requests/${id}`);
      return res.data;
    },
    getAllSupportRequests: async () => {
      const res = await apiClient.get('/support-requests');
      return res.data;
    },
    createSupportRequest: async (data: {
      title: string;
      category: string;
      targetAmount: number;
      description?: string;
      deadline?: string;
      budgetItems?: { description: string; amount: number; evidenceFileId?: string }[];
      evidenceUrl?: string;
    }) => {
      const res = await apiClient.post('/support-requests', data);
      return res.data;
    },
    createRazorpayOrder: async (supportRequestId: number | string, amount: number) => {
      const res = await apiClient.post('/payments/razorpay/create-order', { supportRequestId, amount });
      return res.data;
    },
    verifyPayment: async (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature?: string;
      supportId?: number;
    }) => {
      const res = await apiClient.post('/payments/razorpay/verify', payload);
      return res.data;
    },
    supportDirect: async (requestId: number | string, amount: number) => {
      const res = await apiClient.post(`/support-requests/${requestId}/support`, { amount });
      return res.data;
    },
  },

  sponsorship: {
    createInterest: async (athleteId: number | string, data: {
      organizationName?: string;
      contactPerson?: string;
      supportType?: string;
      proposedAmount?: string | number;
      duration?: string;
      requirements?: string;
      message?: string;
    }) => {
      const res = await apiClient.post(`/athletes/${athleteId}/sponsorship-interest`, data);
      return res.data;
    },
  },
};
