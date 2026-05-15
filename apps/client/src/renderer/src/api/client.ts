import axios, { AxiosInstance } from 'axios';

export async function getApiUrl(): Promise<string> {
  if (window.electron?.getApiUrl) {
    return await window.electron.getApiUrl();
  }
  return 'https://localhost:3000/api';
}

export async function getBaseUrl(): Promise<string> {
  if (window.electron?.getBaseUrl) {
    return await window.electron.getBaseUrl();
  }
  return 'https://localhost:3000';
}

export async function getConfig(): Promise<{ serverUrl: string }> {
  if (window.electron?.getConfig) {
    return window.electron.getConfig();
  }
  return { serverUrl: 'https://localhost:3000' };
}

export async function updateConfig(config: { serverUrl: string }): Promise<{ success: boolean; error?: string }> {
  if (window.electron?.updateConfig) {
    return window.electron.updateConfig(config);
  }
  return { success: false, error: 'Electron API not available' };
}

export async function testConnection(serverUrl: string): Promise<{ success: boolean; message: string }> {
  if (window.electron?.testConnection) {
    return window.electron.testConnection(serverUrl);
  }
  return { success: false, message: 'Electron API not available' };
}

export async function createApiClient(): Promise<AxiosInstance> {
  const apiUrl = await getApiUrl();
  return axios.create({
    baseURL: apiUrl,
  });
}

export const api = {
  getApiUrl,
  getBaseUrl,
  getConfig,
  updateConfig,
  testConnection,
};