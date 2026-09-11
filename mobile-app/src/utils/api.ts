import axios from 'axios';
import { API_URL, Storage } from './config';

/**
 * Authenticated API client.
 * Automatically attaches JWT to every request.
 * Throws errors with user-friendly messages.
 */
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Attach JWT on every outgoing request
api.interceptors.request.use(async (config) => {
  const token = await Storage.getItem('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      throw new Error(
        'Unable to reach the server. Please check your connection and try again.'
      );
    }
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      `Server error (${error.response.status}). Please try again.`;
    throw new Error(msg);
  }
);

export default api;
