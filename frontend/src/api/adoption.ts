import apiClient from './client';
import type { AdoptionImpact } from '../types';

export async function getAdoptionImpact(): Promise<AdoptionImpact[]> {
  const response = await apiClient.get<AdoptionImpact[]>('/adoption-impact');
  return response.data;
}
