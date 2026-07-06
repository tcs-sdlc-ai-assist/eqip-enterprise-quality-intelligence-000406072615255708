import apiClient from './client';
import type {
  PaginatedResponse,
  Integration,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
} from '../types';

export async function getIntegrations(
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<Integration>> {
  const response = await apiClient.get<PaginatedResponse<Integration>>(
    '/integrations',
    { params },
  );
  return response.data;
}

export async function createIntegration(
  data: CreateIntegrationRequest,
): Promise<Integration> {
  const response = await apiClient.post<Integration>('/integrations', data);
  return response.data;
}

export async function updateIntegration(
  id: string,
  data: UpdateIntegrationRequest,
): Promise<Integration> {
  const response = await apiClient.put<Integration>(
    `/integrations/${id}`,
    data,
  );
  return response.data;
}

export async function syncIntegration(
  id: string,
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/integrations/${id}/sync`,
  );
  return response.data;
}
