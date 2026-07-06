import apiClient from './client';
import type {
  PaginatedResponse,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../types';

// ---------------------------------------------------------------------------
// Roles API service
// ---------------------------------------------------------------------------

export interface GetRolesParams {
  page?: number;
  page_size?: number;
}

export async function getRoles(
  params?: GetRolesParams,
): Promise<PaginatedResponse<Role>> {
  const response = await apiClient.get<PaginatedResponse<Role>>('/roles', {
    params,
  });
  return response.data;
}

export async function createRole(data: CreateRoleRequest): Promise<Role> {
  const response = await apiClient.post<Role>('/roles', data);
  return response.data;
}

export async function updateRole(
  id: string,
  data: UpdateRoleRequest,
): Promise<Role> {
  const response = await apiClient.put<Role>(`/roles/${id}`, data);
  return response.data;
}
