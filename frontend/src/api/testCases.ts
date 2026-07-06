import apiClient from './client';
import type {
  PaginatedResponse,
  TestCase,
  TestCaseDetail,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
} from '../types';

// ---------------------------------------------------------------------------
// Test Cases API service
// ---------------------------------------------------------------------------

export interface GetTestCasesParams {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  automation_status?: string;
  application_id?: string;
  owner_id?: string;
  search?: string;
}

export async function getTestCases(
  params?: GetTestCasesParams,
): Promise<PaginatedResponse<TestCase>> {
  // The contract uses `owner` as the query key; map `owner_id` for callers.
  let queryParams: Record<string, unknown> | undefined;
  if (params) {
    const { owner_id, ...rest } = params;
    queryParams = { ...rest };
    if (owner_id !== undefined) {
      queryParams.owner = owner_id;
    }
  }

  const response = await apiClient.get<PaginatedResponse<TestCase>>(
    '/test-cases',
    { params: queryParams },
  );
  return response.data;
}

export async function getTestCase(id: string): Promise<TestCaseDetail> {
  const response = await apiClient.get<TestCaseDetail>(`/test-cases/${id}`);
  return response.data;
}

export async function createTestCase(
  data: CreateTestCaseRequest,
): Promise<TestCase> {
  const response = await apiClient.post<TestCase>('/test-cases', data);
  return response.data;
}

export async function updateTestCase(
  id: string,
  data: UpdateTestCaseRequest,
): Promise<TestCase> {
  const response = await apiClient.put<TestCase>(`/test-cases/${id}`, data);
  return response.data;
}

export async function cloneTestCase(id: string): Promise<TestCase> {
  const response = await apiClient.post<TestCase>(`/test-cases/${id}/clone`, {});
  return response.data;
}
