import apiClient from './client';
import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Auth API service
// ---------------------------------------------------------------------------

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  return response.data;
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken');
  await apiClient.post('/auth/logout', { refresh_token: refreshToken });
}

export async function refreshToken(token: string): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>('/auth/refresh', {
    refresh_token: token,
  });
  return response.data;
}
