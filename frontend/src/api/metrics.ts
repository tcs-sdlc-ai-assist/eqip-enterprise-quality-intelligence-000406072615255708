import apiClient from './client';
import type { Metric } from '../types';

export async function getMetrics(category: string): Promise<Metric[]> {
  const response = await apiClient.get<Metric[]>(`/metrics/${category}`);
  return response.data;
}
