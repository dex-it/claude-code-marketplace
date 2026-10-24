import type { OrderStatus } from '../types';

export const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый',
  paid: 'Оплачен',
  cancelled: 'Отменён',
};
