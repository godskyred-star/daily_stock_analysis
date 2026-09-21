import apiClient from './index';
import { toCamelCase } from './utils';
import type { UsProfitSnapshot } from '../types/market';

export const marketApi = {
  getUsProfitSignals: async (refresh = false): Promise<UsProfitSnapshot> => {
    const response = await apiClient.get<Record<string, unknown>>(
      '/api/v1/market/us-profit-signals',
      { params: refresh ? { refresh: true } : undefined }
    );
    return toCamelCase<UsProfitSnapshot>(response.data);
  },
};
