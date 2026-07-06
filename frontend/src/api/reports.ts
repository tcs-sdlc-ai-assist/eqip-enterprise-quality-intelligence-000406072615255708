import apiClient from './client';
import type { Report } from '../types';

export async function getReport(
  type: string,
  params?: { filters?: Record<string, string> },
): Promise<Report> {
  const response = await apiClient.get<Report>(`/reports/${type}`, {
    params: params?.filters,
  });
  return response.data;
}

export async function exportReport(
  type: string,
  format: string,
): Promise<Blob> {
  const response = await apiClient.post<Blob>(
    `/reports/${type}/export?format=${format}`,
    null,
    { responseType: 'blob' },
  );
  return response.data;
}
