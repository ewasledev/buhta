import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prismaMock: { setting: Record<string, ReturnType<typeof vi.fn>> };

  beforeEach(() => {
    prismaMock = {
      setting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };
    service = new SettingsService(prismaMock as unknown as PrismaService);
  });

  describe('get', () => {
    it('returns value when setting exists', async () => {
      prismaMock.setting.findUnique.mockResolvedValue({ key: 'foo', value: 'bar' });
      expect(await service.get('foo')).toBe('bar');
    });

    it('returns null when setting does not exist', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null);
      expect(await service.get('missing')).toBeNull();
    });
  });

  describe('set', () => {
    it('calls upsert with key and value', async () => {
      prismaMock.setting.upsert.mockResolvedValue({ key: 'foo', value: 'bar' });
      await service.set('foo', 'bar');
      expect(prismaMock.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'foo' }, update: { value: 'bar' } }),
      );
    });
  });

  describe('getNotificationCron', () => {
    it('returns stored value when set', async () => {
      prismaMock.setting.findUnique.mockResolvedValue({ key: service.NOTIFICATION_CRON_KEY, value: '0 10 * * *' });
      expect(await service.getNotificationCron()).toBe('0 10 * * *');
    });

    it('returns DEFAULT_CRON when no value stored', async () => {
      prismaMock.setting.findUnique.mockResolvedValue(null);
      expect(await service.getNotificationCron()).toBe(service.DEFAULT_CRON);
    });
  });
});
