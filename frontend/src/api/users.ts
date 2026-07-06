import apiClient from './client';
import type {
  PaginatedResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
} from '../types';

// ---------------------------------------------------------------------------
// Users API service
// ---------------------------------------------------------------------------

export interface GetUsersParams {
  page?: number;
  page_size?: number;
  status?: string;
  role?: string;
  search?: string;
}

export async function getUsers(
  params?: GetUsersParams,
): Promise<PaginatedResponse<User>> {
  const response = await apiClient.get<PaginatedResponse<User>>('/users', {
    params,
  });
  return response.data;
}

export async function getUser(id: string): Promise<User> {
  const response = await apiClient.get<User>(`/users/${id}`);
  return response.data;
}

export async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await apiClient.post<User>('/users', data);
  return response.data;
}

export async function updateUser(
  id: string,
  data: UpdateUserRequest,
): Promise<User> {
  const response = await apiClient.put<User>(`/users/${id}`, data);
  return response.data;
}
