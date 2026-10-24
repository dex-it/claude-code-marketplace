import { createContext } from 'react';
import type { DashboardFilters } from '../../lib/dashboard';
import type { Order } from '../../types';

export interface DashboardState {
  orders: Order[];
  filters: DashboardFilters;
  now: Date;
}

export const DashboardContext = createContext<DashboardState>({
  orders: [],
  filters: { status: 'all', from: '', to: '' },
  now: new Date(),
});
