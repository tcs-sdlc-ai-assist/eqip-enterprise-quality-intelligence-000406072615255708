import apiClient from './client';
import type {
  AISearchRequest,
  AISearchResponse,
  AIAskRequest,
  AIAskResponse,
  AIPredictionRequest,
  AIPredictionResponse,
} from '../types';

export async function aiSearch(
  data: AISearchRequest,
): Promise<AISearchResponse> {
  const response = await apiClient.post<AISearchResponse>('/ai/search', data);
  return response.data;
}

export async function aiAsk(data: AIAskRequest): Promise<AIAskResponse> {
  const response = await apiClient.post<AIAskResponse>('/ai/ask', data);
  return response.data;
}

export async function aiPredict(
  type: string,
  data: AIPredictionRequest,
): Promise<AIPredictionResponse> {
  const response = await apiClient.post<AIPredictionResponse>(
    `/ai/predictions/${type}`,
    data,
  );
  return response.data;
}
