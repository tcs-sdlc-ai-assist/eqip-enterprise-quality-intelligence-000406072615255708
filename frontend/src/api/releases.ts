import apiClient from './client';
import type {
  ReleaseReadiness,
  ReleaseGateResults,
  UpdateGateResultsRequest,
} from '../types';

// ---------------------------------------------------------------------------
// Releases API service
// ---------------------------------------------------------------------------

export async function getReleaseReadiness(
  id: string,
): Promise<ReleaseReadiness> {
  const response = await apiClient.get<ReleaseReadiness>(
    `/releases/${id}/readiness`,
  );
  return response.data;
}

export async function getGateResults(
  id: string,
): Promise<ReleaseGateResults> {
  const response = await apiClient.get<ReleaseGateResults>(
    `/releases/${id}/gate-results`,
  );
  return response.data;
}

export async function updateGateResults(
  id: string,
  data: UpdateGateResultsRequest,
): Promise<ReleaseGateResults> {
  const response = await apiClient.put<ReleaseGateResults>(
    `/releases/${id}/gate-results`,
    data,
  );
  return response.data;
}
