import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

const DAY = 86_400_000;

describe('NotificationsService', () => {
  let service: NotificationsService;
  let sendMessage: ReturnType<typeof vi.fn>;
  let findExpiringOn: ReturnType<typeof vi.fn>;
  let findExpiredVip: ReturnType<typeof vi.fn>;
  let extend: ReturnType<typeof vi.fn>;

  const subToday    = { endDate: new Date(),           client: { name: 'Иван Петров',   isVip: false } };
  const subTomorrow = { endDate: new Date(Date.now() + DAY), client: { name: 'Мария Иванова', isVip: false } };

  const expiredVipEntry = {
    client: { name: 'VIP Клиент' },
    subscription: {
      id: 10,
      startDate: new Date(Date.now() - DAY * 60),
      endDate:   new Date(Date.now() - DAY * 30),
    },
  };

  beforeEach(() => {
    sendMessage    = vi.fn().mockResolvedValue(undefined);
    findExpiringOn = vi.fn().mockResolvedValue([]);
    findExpiredVip = vi.fn().mockResolvedValue([]);
    extend         = vi.fn().mockResolvedValue({});

    service = new NotificationsService(
      { telegram: { sendMessage } } as any,
      { findExpiringOn, findExpiredVip, extend } as any,
      { getNotificationCron: vi.fn(), DEFAULT_CRON: '0 9 * * *' } as any,
      { getCronJob: vi.fn() } as any,
      { getOrThrow: vi.fn().mockReturnValue('123456789') } as any,
    );
  });

  // ─── Existing expiry notification tests ─────────────────────────────────────

  it('does not send a message when no expiring and no VIP renewals', async () => {
    await service.checkExpiringSubscriptions();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends message with ⚠️ block when subscriptions expire today', async () => {
    findExpiringOn.mockResolvedValueOnce([subToday]).mockResolvedValueOnce([]);
    await service.checkExpiringSubscriptions();
    expect(sendMessage).toHaveBeenCalledOnce();
    const text: string = sendMessage.mock.calls[0][1];
    expect(text).toContain('⚠️');
    expect(text).toContain('Иван Петров');
  });

  it('sends message with 🔔 block when subscriptions expire tomorrow', async () => {
    findExpiringOn.mockResolvedValueOnce([]).mockResolvedValueOnce([subTomorrow]);
    await service.checkExpiringSubscriptions();
    const text: string = sendMessage.mock.calls[0][1];
    expect(text).toContain('🔔');
    expect(text).toContain('Мария Иванова');
  });

  it('sends single message with both ⚠️ and 🔔 blocks', async () => {
    findExpiringOn.mockResolvedValueOnce([subToday]).mockResolvedValueOnce([subTomorrow]);
    await service.checkExpiringSubscriptions();
    expect(sendMessage).toHaveBeenCalledOnce();
    const text: string = sendMessage.mock.calls[0][1];
    expect(text).toContain('⚠️');
    expect(text).toContain('🔔');
  });

  it('does not throw when sendMessage fails', async () => {
    findExpiringOn.mockResolvedValueOnce([subToday]).mockResolvedValueOnce([]);
    sendMessage.mockRejectedValue(new Error('Telegram error'));
    await expect(service.checkExpiringSubscriptions()).resolves.not.toThrow();
  });

  it('skips VIP clients in expiry notifications', async () => {
    const vipSub = { endDate: new Date(), client: { name: 'VIP', isVip: true } };
    findExpiringOn.mockResolvedValueOnce([vipSub]).mockResolvedValueOnce([]);
    await service.checkExpiringSubscriptions();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  // ─── VIP auto-renewal tests ──────────────────────────────────────────────────

  it('auto-renews expired VIP subscription and notifies admin with 🔄 block', async () => {
    findExpiredVip.mockResolvedValue([expiredVipEntry]);
    await service.checkExpiringSubscriptions();

    expect(extend).toHaveBeenCalledOnce();
    const [subId, newDate] = extend.mock.calls[0];
    expect(subId).toBe(10);
    expect(newDate).toBeInstanceOf(Date);
    expect(newDate > expiredVipEntry.subscription.endDate).toBe(true);

    expect(sendMessage).toHaveBeenCalledOnce();
    const text: string = sendMessage.mock.calls[0][1];
    expect(text).toContain('🔄');
    expect(text).toContain('VIP Клиент');
  });

  it('renewal duration equals the original subscription period', async () => {
    findExpiredVip.mockResolvedValue([expiredVipEntry]);
    await service.checkExpiringSubscriptions();

    const [, newEndDate] = extend.mock.calls[0];
    const originalDuration =
      expiredVipEntry.subscription.endDate.getTime() -
      expiredVipEntry.subscription.startDate.getTime();
    const renewedDuration =
      newEndDate.getTime() - expiredVipEntry.subscription.endDate.getTime();
    expect(renewedDuration).toBe(originalDuration);
  });

  it('sends single message with 🔄 and 🔔 when VIP renewed and non-VIP expiring tomorrow', async () => {
    findExpiredVip.mockResolvedValue([expiredVipEntry]);
    findExpiringOn.mockResolvedValueOnce([]).mockResolvedValueOnce([subTomorrow]);
    await service.checkExpiringSubscriptions();

    expect(sendMessage).toHaveBeenCalledOnce();
    const text: string = sendMessage.mock.calls[0][1];
    expect(text).toContain('🔄');
    expect(text).toContain('🔔');
  });

  it('does not send when no expiring non-VIP and no VIP to renew', async () => {
    findExpiredVip.mockResolvedValue([]);
    findExpiringOn.mockResolvedValue([]);
    await service.checkExpiringSubscriptions();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
