import type { Notification } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../middleware/errorHandler.js';
import type { UpdateNotificationRequest } from './schema.js';

export function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    message: notification.message,
    read: notification.read,
    created_at: notification.createdAt.toISOString(),
    updated_at: notification.updatedAt.toISOString(),
  };
}

export async function listNotifications(
  clientId: string,
  read: boolean | undefined,
  page: number,
  perPage: number,
): Promise<{ items: Notification[]; total: number }> {
  const where = { clientId, ...(read !== undefined && { read }) };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items, total };
}

export async function updateNotification(
  clientId: string,
  id: string,
  input: UpdateNotificationRequest,
): Promise<Notification> {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.clientId !== clientId) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return prisma.notification.update({ where: { id }, data: { read: input.read } });
}

/** Plain helper (not a route) — called from modules/reports/service.ts when a report newly completes. See spec.md's "Resolved conflicts". */
export async function createNotification(clientId: string, message: string): Promise<void> {
  await prisma.notification.create({ data: { clientId, message } });
}
