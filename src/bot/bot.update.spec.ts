import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsService } from '../clients/clients.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SettingsService } from '../settings/settings.service';
import { BotUpdate } from './bot.update';
import { CUSTOM_DATE_SCENE } from './scenes/subscription/custom-date.scene';
import { EDIT_SCHEDULE_SCENE } from './scenes/schedule/edit-schedule.scene';

const makeCtx = (matchValues: string[]) => ({
  answerCbQuery: vi.fn(),
  editMessageText: vi.fn(),
  scene: { enter: vi.fn() },
  match: matchValues,
});

describe('BotUpdate', () => {
  let botUpdate: BotUpdate;
  let clientsMock: Partial<ClientsService>;
  let subsMock: Partial<SubscriptionsService>;
  let settingsMock: Partial<SettingsService>;

  const client = { id: 5, name: 'Иван', subscriptions: [] };
  const activeSubscription = { id: 10, endDate: new Date(2026, 4, 30), startDate: new Date(), clientId: 5 };

  beforeEach(() => {
    clientsMock = {
      findOne: vi.fn().mockResolvedValue(client),
      findAllWithSubscriptions: vi.fn().mockResolvedValue([]),
    };
    subsMock = {
      getActive: vi.fn(),
      findByClient: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      extend: vi.fn().mockResolvedValue({ endDate: new Date(2026, 5, 30) }),
    };
    settingsMock = {
      getNotificationCron: vi.fn().mockResolvedValue('0 9 * * *'),
      DEFAULT_CRON: '0 9 * * *',
    };
    botUpdate = new BotUpdate(clientsMock as any, subsMock as any, settingsMock as any);
  });

  // ─── onClientsList ───────────────────────────────────────────────────────────

  describe('onClientsList', () => {
    it('renders client list keyboard with back-to-menu button', async () => {
      (clientsMock as any).findAll = vi.fn().mockResolvedValue([]);
      botUpdate = new BotUpdate(clientsMock as any, subsMock as any, settingsMock as any);
      const ctx = makeCtx([]);
      await botUpdate.onClientsList(ctx as any);
      const markup = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0][1];
      const buttons = markup.reply_markup.inline_keyboard.flat();
      const hasBack = buttons.some((b: any) => b.callback_data === 'menu:back');
      expect(hasBack).toBe(true);
    });
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

  // ─── onSubEdit ───────────────────────────────────────────────────────────────

  describe('onSubEdit', () => {
    it('enters CUSTOM_DATE_SCENE with extend mode and subscriptionId', async () => {
      const ctx = makeCtx(['', '10', '5']);
      await botUpdate.onSubEdit(ctx as any);
      expect(ctx.scene.enter).toHaveBeenCalledWith(CUSTOM_DATE_SCENE, {
        clientId: 5,
        subscriptionId: 10,
        mode: 'extend',
      });
    });
  });

  // ─── onClientDetail ──────────────────────────────────────────────────────────

  describe('onClientDetail', () => {
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);

    it('shows price in ₽ in the client card text', async () => {
      const clientWithPrice = { id: 5, name: 'Иван', isVip: false, price: 4500, subscriptions: [] };
      (clientsMock.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(clientWithPrice);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onClientDetail(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('4500 ₽');
    });

    it('shows ✅ when active subscription exists', async () => {
      const clientWithActive = { id: 5, name: 'Иван', isVip: false, price: 0, subscriptions: [{ endDate: future }] };
      (clientsMock.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(clientWithActive);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onClientDetail(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('✅');
    });

    it('shows ❌ истекла when subscription exists but expired', async () => {
      const clientExpired = { id: 5, name: 'Иван', isVip: false, price: 0, subscriptions: [{ endDate: past }] };
      (clientsMock.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(clientExpired);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onClientDetail(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('❌ истекла');
    });

    it('shows ⬜ when no subscriptions at all', async () => {
      const clientNoSub = { id: 5, name: 'Иван', isVip: false, price: 0, subscriptions: [] };
      (clientsMock.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(clientNoSub);
      const ctx = makeCtx(['', '5']);
      await botUpdate.onClientDetail(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('⬜ нет подписки');
    });
  });

  // ─── onScheduleEdit ──────────────────────────────────────────────────────────

  // ─── onClientsInfo ───────────────────────────────────────────────────────────

  describe('onClientsInfo', () => {
    it('shows total price sum in the info screen', async () => {
      const clientsWithPrices = [
        { id: 1, name: 'А', isVip: false, price: 3000, subscriptions: [] },
        { id: 2, name: 'Б', isVip: false, price: 5000, subscriptions: [] },
      ];
      (clientsMock as any).findAllWithSubscriptions = vi.fn().mockResolvedValue(clientsWithPrices);
      botUpdate = new BotUpdate(clientsMock as any, subsMock as any, settingsMock as any);
      const ctx = makeCtx([]);
      await botUpdate.onClientsInfo(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('8000 ₽');
      expect(text).toContain('Всего: 2');
    });
  });

  describe('onScheduleEdit', () => {
    it('enters EDIT_SCHEDULE_SCENE', async () => {
      const ctx = makeCtx([]);
      await botUpdate.onScheduleEdit(ctx as any);
      expect(ctx.scene.enter).toHaveBeenCalledWith(EDIT_SCHEDULE_SCENE);
    });
  });

  // ─── onToggleVip ─────────────────────────────────────────────────────────────

  describe('onToggleVip', () => {
    it('calls toggleVip and re-renders client detail with ⭐ when now VIP', async () => {
      const vipClient = { id: 5, name: 'Иван', isVip: true, subscriptions: [] };
      // toggleVip is mocked — doesn't call findOne internally, so findOne is called once
      (clientsMock.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(vipClient);
      (clientsMock as any).toggleVip = vi.fn().mockResolvedValue(vipClient);
      botUpdate = new BotUpdate(clientsMock as any, subsMock as any, settingsMock as any);

      const ctx = makeCtx(['', '5']);
      await botUpdate.onToggleVip(ctx as any);
      expect((clientsMock as any).toggleVip).toHaveBeenCalledWith(5);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).toContain('⭐');
    });

    it('renders without ⭐ when VIP is removed', async () => {
      const nonVipClient = { id: 5, name: 'Иван', isVip: false, subscriptions: [] };
      (clientsMock.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(nonVipClient);
      (clientsMock as any).toggleVip = vi.fn().mockResolvedValue(nonVipClient);
      botUpdate = new BotUpdate(clientsMock as any, subsMock as any, settingsMock as any);

      const ctx = makeCtx(['', '5']);
      await botUpdate.onToggleVip(ctx as any);
      const [text] = (ctx.editMessageText as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(text).not.toContain('⭐');
    });
  });
});
