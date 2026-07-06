import apiClient from './client';
import type { Evidence } from '../types';

export async function uploadEvidence(data: FormData): Promise<Evidence> {
  const response = await apiClient.post<Evidence>('/evidence', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function downloadEvidence(id: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/evidence/${id}/download`, {
    responseType: 'blob',
  });
  return response.data;
}
