import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prismaMock: { subscription: Record<string, ReturnType<typeof vi.fn>> };

  beforeEach(() => {
    prismaMock = {
      subscription: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new SubscriptionsService(prismaMock as unknown as PrismaService);
  });

  describe('resolveEndDate', () => {
    const base = new Date(2026, 0, 15); // 15 Jan 2026

    it('adds 1 month for "1m"', () => {
      expect(service.resolveEndDate(base, '1m').getMonth()).toBe(1); // Feb
    });

    it('adds 3 months for "3m"', () => {
      expect(service.resolveEndDate(base, '3m').getMonth()).toBe(3); // Apr
    });

    it('adds 6 months for "6m"', () => {
      expect(service.resolveEndDate(base, '6m').getMonth()).toBe(6); // Jul
    });

    it('adds 1 year for "1y"', () => {
      expect(service.resolveEndDate(base, '1y').getFullYear()).toBe(2027);
    });

    it('returns the passed Date instance unchanged', () => {
      const custom = new Date(2027, 5, 30);
      expect(service.resolveEndDate(base, custom)).toBe(custom);
    });
  });

  describe('findExpiringOn', () => {
    it('queries with start-of-day and end-of-day for the given date', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([]);
      await service.findExpiringOn(new Date(2026, 3, 25));

      const { where } = prismaMock.subscription.findMany.mock.calls[0][0];
      expect(where.endDate.gte.getDate()).toBe(25);
      expect(where.endDate.gte.getHours()).toBe(0);
      expect(where.endDate.lte.getHours()).toBe(23);
    });
  });

  describe('create', () => {
    it('creates subscription with correct clientId and resolved endDate', async () => {
      const sub = { id: 1, clientId: 5, startDate: new Date(), endDate: new Date() };
      prismaMock.subscription.create.mockResolvedValue(sub);
      await service.create(5, '1m');
      expect(prismaMock.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientId: 5 }) }),
      );
    });
  });

  describe('extend', () => {
    it('extends endDate from existing subscription endDate plus duration', async () => {
      const existing = { id: 1, clientId: 5, endDate: new Date(2026, 3, 30), startDate: new Date() };
      prismaMock.subscription.findUnique.mockResolvedValue(existing);
      prismaMock.subscription.update.mockResolvedValue({ ...existing });
      await service.extend(1, '1m');

      const { data } = prismaMock.subscription.update.mock.calls[0][0];
      expect(data.endDate.getMonth()).toBe(4); // May
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when subscription not found', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});
