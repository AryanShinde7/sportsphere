import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

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
    register: async (userData: { name: string; email: string; password: string; role?: string }) => {
      const res = await apiClient.post('/auth/register', { role: 'SUPPORTER', ...userData });
      return res.data;
    },
    getMe: async () => {
      const res = await apiClient.get('/auth/me');
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
  },

  support: {
    getSupportRequest: async (id: number | string) => {
      const res = await apiClient.get(`/support-requests/${id}`);
      return res.data;
    },
    supportDirect: async (requestId: number | string, amount: number) => {
      const res = await apiClient.post(`/support-requests/${requestId}/support`, { amount });
      return res.data;
    },
    createRazorpayOrder: async (amount: number, currency: string = 'INR') => {
      const res = await apiClient.post('/payments/razorpay/create-order', { amount, currency });
      return res.data;
    },
    mockRazorpayWebhook: async (payload: {
      orderId: string;
      paymentId: string;
      supportRequestId: number | string;
      amount: number;
    }) => {
      const res = await apiClient.post('/payments/razorpay/webhook', {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: payload.paymentId,
              order_id: payload.orderId,
              amount: payload.amount,
              status: 'captured',
              notes: {
                supportRequestId: payload.supportRequestId,
              },
            },
          },
        },
      });
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
