import apiClient from './client';
import type {
  PaginatedResponse,
  TestExecution,
  CreateTestExecutionRequest,
  UpdateTestExecutionRequest,
} from '../types';

// ---------------------------------------------------------------------------
// Test Executions API service
// ---------------------------------------------------------------------------

export interface GetTestExecutionsParams {
  page?: number;
  page_size?: number;
  status?: string;
  application_id?: string;
  release_id?: string;
}

export async function getTestExecutions(
  params?: GetTestExecutionsParams,
): Promise<PaginatedResponse<TestExecution>> {
  const response = await apiClient.get<PaginatedResponse<TestExecution>>(
    '/test-executions',
    { params },
  );
  return response.data;
}

export async function getTestExecution(id: string): Promise<TestExecution> {
  const response = await apiClient.get<TestExecution>(
    `/test-executions/${id}`,
  );
  return response.data;
}

export async function createTestExecution(
  data: CreateTestExecutionRequest,
): Promise<TestExecution> {
  const response = await apiClient.post<TestExecution>(
    '/test-executions',
    data,
  );
  return response.data;
}

export async function updateTestExecution(
  id: string,
  data: UpdateTestExecutionRequest,
): Promise<TestExecution> {
  const response = await apiClient.put<TestExecution>(
    `/test-executions/${id}`,
    data,
  );
  return response.data;
}
