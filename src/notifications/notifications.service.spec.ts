import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

const DAY = 86_400_000;

describe('NotificationsService', () => {
  let service: NotificationsService;
  let sendMessage: ReturnType<typeof vi.fn>;
  let findExpiringOn: ReturnType<typeof vi.fn>;

  const subToday = { endDate: new Date(), client: { name: 'Иван Петров' } };
  const subTomorrow = {
    endDate: new Date(Date.now() + DAY),
    client: { name: 'Мария Иванова' },
  };

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue(undefined);
    findExpiringOn = vi.fn();

    service = new NotificationsService(
      { telegram: { sendMessage } } as any,
      { findExpiringOn } as any,
      { getOrThrow: vi.fn().mockReturnValue('123456789') } as any,
    );
  });

  it('does not send a message when both lists are empty', async () => {
    findExpiringOn.mockResolvedValue([]);
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
    expect(sendMessage).toHaveBeenCalledOnce();
    const text: string = sendMessage.mock.calls[0][1];
    expect(text).toContain('🔔');
    expect(text).toContain('Мария Иванова');
  });

  it('sends single message with both blocks when both lists have entries', async () => {
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
});
