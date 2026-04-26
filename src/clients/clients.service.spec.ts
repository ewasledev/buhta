import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prismaMock: { client: Record<string, ReturnType<typeof vi.fn>> };

  beforeEach(() => {
    prismaMock = {
      client: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new ClientsService(prismaMock as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns all clients ordered by name', async () => {
      const clients = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
      prismaMock.client.findMany.mockResolvedValue(clients);
      expect(await service.findAll()).toBe(clients);
      expect(prismaMock.client.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });

  describe('findOne', () => {
    it('returns client when found', async () => {
      const client = { id: 1, name: 'Ivan', subscriptions: [] };
      prismaMock.client.findUnique.mockResolvedValue(client);
      expect(await service.findOne(1)).toBe(client);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates client when name is unique', async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);
      const created = { id: 1, name: 'Ivan', price: 5000 };
      prismaMock.client.create.mockResolvedValue(created);
      expect(await service.create({ name: 'Ivan', price: 5000 })).toBe(created);
    });

    it('passes price to prisma.create', async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);
      prismaMock.client.create.mockResolvedValue({ id: 1, name: 'Ivan', price: 3000 });
      await service.create({ name: 'Ivan', price: 3000 });
      expect(prismaMock.client.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ price: 3000 }) }),
      );
    });

    it('throws ConflictException when name already exists', async () => {
      prismaMock.client.findUnique.mockResolvedValue({ id: 1, name: 'Ivan' });
      await expect(service.create({ name: 'Ivan', price: 0 })).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePrice', () => {
    it('updates price field only', async () => {
      const client = { id: 1, name: 'Ivan', price: 0, isVip: false, subscriptions: [] };
      prismaMock.client.findUnique.mockResolvedValue(client);
      prismaMock.client.update.mockResolvedValue({ ...client, price: 7000 });
      await service.updatePrice(1, 7000);
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { price: 7000 } }),
      );
    });

    it('throws NotFoundException when client not found', async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);
      await expect(service.updatePrice(99, 100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates client when new name is available', async () => {
      const existing = { id: 1, name: 'Ivan', subscriptions: [] };
      prismaMock.client.findUnique
        .mockResolvedValueOnce(existing) // findOne inside update
        .mockResolvedValueOnce(null);    // duplicate name check
      const updated = { id: 1, name: 'Ivan New' };
      prismaMock.client.update.mockResolvedValue(updated);
      expect(await service.update(1, { name: 'Ivan New' })).toBe(updated);
    });

    it('throws ConflictException when new name belongs to another client', async () => {
      const existing = { id: 1, name: 'Ivan', subscriptions: [] };
      const duplicate = { id: 2, name: 'Maria' };
      prismaMock.client.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(duplicate);
      await expect(service.update(1, { name: 'Maria' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes client when found', async () => {
      const client = { id: 1, name: 'Ivan', subscriptions: [] };
      prismaMock.client.findUnique.mockResolvedValue(client);
      prismaMock.client.delete.mockResolvedValue(client);
      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('throws NotFoundException when client does not exist', async () => {
      prismaMock.client.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllWithSubscriptions', () => {
    it('includes latest subscription per client', async () => {
      const clients = [{ id: 1, name: 'Ivan', subscriptions: [{ endDate: new Date() }] }];
      prismaMock.client.findMany.mockResolvedValue(clients);
      const result = await service.findAllWithSubscriptions();
      expect(result).toBe(clients);
      expect(prismaMock.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ subscriptions: expect.any(Object) }) }),
      );
    });
  });

  describe('toggleVip', () => {
    it('sets isVip to true when client is not VIP', async () => {
      const client = { id: 1, name: 'Ivan', isVip: false, subscriptions: [] };
      prismaMock.client.findUnique.mockResolvedValue(client);
      prismaMock.client.update.mockResolvedValue({ ...client, isVip: true });
      await service.toggleVip(1);
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isVip: true } }),
      );
    });

    it('sets isVip to false when client is VIP', async () => {
      const client = { id: 1, name: 'Ivan', isVip: true, subscriptions: [] };
      prismaMock.client.findUnique.mockResolvedValue(client);
      prismaMock.client.update.mockResolvedValue({ ...client, isVip: false });
      await service.toggleVip(1);
      expect(prismaMock.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isVip: false } }),
      );
    });
  });
});
