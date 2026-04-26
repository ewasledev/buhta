import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsService } from '../clients/clients.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BotUpdate } from './bot.update';
import { CUSTOM_DATE_SCENE } from './scenes/subscription/custom-date.scene';

const makeCtx = (matchValues: string[]) => ({
  answerCbQuery: vi.fn(),
  editMessageText: vi.fn(),
  scene: { enter: vi.fn() },
  match: matchValues,
});

describe('BotUpdate — subscription add logic', () => {
  let botUpdate: BotUpdate;
  let clientsMock: Partial<ClientsService>;
  let subsMock: Partial<SubscriptionsService>;

  const client = { id: 5, name: 'Иван', subscriptions: [] };
  const activeSubscription = { id: 10, endDate: new Date(2026, 4, 30), startDate: new Date(), clientId: 5 };

  beforeEach(() => {
    clientsMock = { findOne: vi.fn().mockResolvedValue(client) };
    subsMock = {
      getActive: vi.fn(),
      findByClient: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      extend: vi.fn().mockResolvedValue({ endDate: new Date(2026, 5, 30) }),
    };
    botUpdate = new BotUpdate(clientsMock as any, subsMock as any);
  });

  // ─── onSubsAdd ───────────────────────────────────────────────────────────────

  describe('onSubsAdd', () => {
    it('shows add keyboard when no active subscription exists', async () => {
      (subsMock.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onSubsAdd(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('Добавить');
      expect(text).not.toContain('Продление');
    });

    it('shows extend keyboard with end-date info when active subscription exists', async () => {
      (subsMock.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(activeSubscription);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onSubsAdd(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('Продление');
      expect(text).toContain('30.05.2026');
      expect(text).toContain('начнётся с этой даты');
    });
  });

  // ─── onSubsAddDuration ───────────────────────────────────────────────────────

  describe('onSubsAddDuration', () => {
    it('calls create when no active subscription', async () => {
      (subsMock.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const ctx = makeCtx(['', '1m', '5']);
      await botUpdate.onSubsAddDuration(ctx as any);
      expect(subsMock.create).toHaveBeenCalledWith(5, '1m');
      expect(subsMock.extend).not.toHaveBeenCalled();
    });

    it('calls extend on active subscription — preserves paid months', async () => {
      (subsMock.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(activeSubscription);
      const ctx = makeCtx(['', '1m', '5']);
      await botUpdate.onSubsAddDuration(ctx as any);
      expect(subsMock.extend).toHaveBeenCalledWith(activeSubscription.id, '1m');
      expect(subsMock.create).not.toHaveBeenCalled();
    });
  });

  // ─── onSubsAddCustom ─────────────────────────────────────────────────────────

  describe('onSubsAddCustom', () => {
    it('enters scene in add mode when no active subscription', async () => {
      (subsMock.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onSubsAddCustom(ctx as any);
      expect(ctx.scene.enter).toHaveBeenCalledWith(CUSTOM_DATE_SCENE, { clientId: 5, mode: 'add' });
    });

    it('enters scene in extend mode with subscriptionId when active subscription exists', async () => {
      (subsMock.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(activeSubscription);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onSubsAddCustom(ctx as any);
      expect(ctx.scene.enter).toHaveBeenCalledWith(CUSTOM_DATE_SCENE, {
        clientId: 5,
        subscriptionId: activeSubscription.id,
        mode: 'extend',
      });
    });
  });
});
