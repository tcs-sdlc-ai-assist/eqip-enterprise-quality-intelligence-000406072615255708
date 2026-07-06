import apiClient from './client';
import type { PaginatedResponse, AuditLog } from '../types';

export async function getAuditLogs(
  params?: {
    page?: number;
    page_size?: number;
    user_id?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<PaginatedResponse<AuditLog>> {
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(
    '/audit-logs',
    { params },
  );
  return response.data;
}
