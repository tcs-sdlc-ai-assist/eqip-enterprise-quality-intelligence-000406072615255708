import apiClient from './client';
import type {
  PaginatedResponse,
  GovernanceProcedure,
  CreateGovernanceProcedureRequest,
  UpdateGovernanceProcedureRequest,
} from '../types';

export async function getGovernanceProcedures(
  params?: { page?: number; page_size?: number },
): Promise<PaginatedResponse<GovernanceProcedure>> {
  const response = await apiClient.get<PaginatedResponse<GovernanceProcedure>>(
    '/governance-procedures',
    { params },
  );
  return response.data;
}

export async function getGovernanceProcedure(
  id: string,
): Promise<GovernanceProcedure> {
  const response = await apiClient.get<GovernanceProcedure>(
    `/governance-procedures/${id}`,
  );
  return response.data;
}

export async function createGovernanceProcedure(
  data: CreateGovernanceProcedureRequest,
): Promise<GovernanceProcedure> {
  const response = await apiClient.post<GovernanceProcedure>(
    '/governance-procedures',
    data,
  );
  return response.data;
}

export async function updateGovernanceProcedure(
  id: string,
  data: UpdateGovernanceProcedureRequest,
): Promise<GovernanceProcedure> {
  const response = await apiClient.put<GovernanceProcedure>(
    `/governance-procedures/${id}`,
    data,
  );
  return response.data;
}
