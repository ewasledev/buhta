import { Action, Command, Ctx, Update } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { SubscriptionsService, Duration } from '../subscriptions/subscriptions.service';
import { AdminGuard } from './guards/admin.guard';
import { BotContext } from './context.interface';
import { mainMenuKeyboard } from './keyboards/main-menu.keyboard';
import {
  clientListKeyboard,
  clientDetailKeyboard,
  clientDeleteConfirmKeyboard,
} from './keyboards/client.keyboard';
import {
  subscriptionListKeyboard,
  subscriptionDetailKeyboard,
  subscriptionDeleteConfirmKeyboard,
  addDurationKeyboard,
  extendDurationKeyboard,
} from './keyboards/subscription.keyboard';
import { CLIENT_CREATE_SCENE } from './scenes/client/client-create.scene';
import { CLIENT_EDIT_SCENE } from './scenes/client/client-edit.scene';
import { CUSTOM_DATE_SCENE } from './scenes/subscription/custom-date.scene';
import { formatDate, isActive, statusLabel } from '../common/utils/date.utils';

@Update()
@UseGuards(AdminGuard)
export class BotUpdate {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Command('start')
  async onStart(@Ctx() ctx: BotContext) {
    await ctx.reply('Главное меню:', mainMenuKeyboard());
  }

  @Command('menu')
  async onMenu(@Ctx() ctx: BotContext) {
    await ctx.reply('Главное меню:', mainMenuKeyboard());
  }

  @Command('help')
  async onHelp(@Ctx() ctx: BotContext) {
    await ctx.reply(
      '📋 Команды:\n' +
      '\n/start — главное меню' +
      '\n/menu — главное меню' +
      '\n/help — эта справка' +
      '\n/cancel — отменить текущий ввод' +
      '\n\n📌 Как работать:' +
      '\nГлавное меню → Клиенты → выбери клиента → Подписки → Добавить' +
      '\n\n📅 Формат даты при вводе вручную: ДД.ММ.ГГГГ\nПример: 31.12.2026',
    );
  }

  // ─── Clients ────────────────────────────────────────────────────────────────

  @Action('clients:list')
  async onClientsList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const clients = await this.clientsService.findAll();
    const text = clients.length ? '👥 Клиенты:' : '👥 Клиентов пока нет.';
    await ctx.editMessageText(text, clientListKeyboard(clients));
  }

  @Action('clients:create')
  async onClientsCreate(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter(CLIENT_CREATE_SCENE);
  }

  @Action(/^clients:detail:(\d+)$/)
  async onClientDetail(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = parseInt(ctx.match![1]);
    const client = await this.clientsService.findOne(id);
    const active = client.subscriptions.find((s) => isActive(s.endDate));
    const subText = active ? `✅ активна до ${formatDate(active.endDate)}` : '❌ отсутствует';
    await ctx.editMessageText(`👤 ${client.name}\n\nПодписка: ${subText}`, clientDetailKeyboard(id));
  }

  @Action(/^clients:edit:(\d+)$/)
  async onClientEdit(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = parseInt(ctx.match![1]);
    await ctx.scene.enter(CLIENT_EDIT_SCENE, { clientId: id });
  }

  @Action(/^clients:delete:(\d+)$/)
  async onClientDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = parseInt(ctx.match![1]);
    const client = await this.clientsService.findOne(id);
    await ctx.editMessageText(
      `🗑 Удалить "${client.name}" и все его подписки?\nЭто действие нельзя отменить.`,
      clientDeleteConfirmKeyboard(id),
    );
  }

  @Action(/^clients:delete:confirm:(\d+)$/)
  async onClientDeleteConfirm(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = parseInt(ctx.match![1]);
    await this.clientsService.remove(id);
    const clients = await this.clientsService.findAll();
    const text = clients.length ? '👥 Клиенты:' : '👥 Клиентов пока нет.';
    await ctx.editMessageText(text, clientListKeyboard(clients));
  }

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  @Action(/^subs:list:(\d+)$/)
  async onSubsList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const clientId = parseInt(ctx.match![1]);
    const client = await this.clientsService.findOne(clientId);
    const subs = await this.subscriptionsService.findByClient(clientId);
    const text = `📋 Подписки — ${client.name}:` + (subs.length ? '' : '\n\nПодписок нет.');
    await ctx.editMessageText(text, subscriptionListKeyboard(subs, clientId));
  }

  @Action(/^subs:add:(\d+)$/)
  async onSubsAdd(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const clientId = parseInt(ctx.match![1]);
    const client = await this.clientsService.findOne(clientId);
    const active = await this.subscriptionsService.getActive(clientId);
    if (active) {
      await ctx.editMessageText(
        `🔄 Продление подписки — ${client.name}\n\n` +
          `⚠️ Активная подписка до ${formatDate(active.endDate)}.\n` +
          `Продление начнётся с этой даты.\n\nВыберите срок:`,
        extendDurationKeyboard(active.id, clientId),
      );
    } else {
      await ctx.editMessageText(
        `➕ Добавить подписку — ${client.name}\n\nВыберите срок:`,
        addDurationKeyboard(clientId),
      );
    }
  }

  @Action(/^subs:add:(1m|3m|6m|1y):(\d+)$/)
  async onSubsAddDuration(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const duration = ctx.match![1] as Duration;
    const clientId = parseInt(ctx.match![2]);
    const active = await this.subscriptionsService.getActive(clientId);
    if (active) {
      await this.subscriptionsService.extend(active.id, duration);
    } else {
      await this.subscriptionsService.create(clientId, duration);
    }
    const subs = await this.subscriptionsService.findByClient(clientId);
    await ctx.editMessageText('✅ Подписка обновлена.', subscriptionListKeyboard(subs, clientId));
  }

  @Action(/^subs:add:custom:(\d+)$/)
  async onSubsAddCustom(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const clientId = parseInt(ctx.match![1]);
    const active = await this.subscriptionsService.getActive(clientId);
    if (active) {
      await ctx.scene.enter(CUSTOM_DATE_SCENE, { clientId, subscriptionId: active.id, mode: 'extend' });
    } else {
      await ctx.scene.enter(CUSTOM_DATE_SCENE, { clientId, mode: 'add' });
    }
  }

  @Action(/^subs:detail:(\d+):(\d+)$/)
  async onSubDetail(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const subId = parseInt(ctx.match![1]);
    const clientId = parseInt(ctx.match![2]);
    const sub = await this.subscriptionsService.findOne(subId);
    const text = `📋 ${formatDate(sub.startDate)} — ${formatDate(sub.endDate)}\n${statusLabel(sub.endDate)}`;
    await ctx.editMessageText(text, subscriptionDetailKeyboard(subId, clientId));
  }

  @Action(/^subs:extend:(\d+):(\d+)$/)
  async onSubExtend(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const subId = parseInt(ctx.match![1]);
    const clientId = parseInt(ctx.match![2]);
    const sub = await this.subscriptionsService.findOne(subId);
    await ctx.editMessageText(
      `🔄 Продлить подписку\n\nТекущая: ${formatDate(sub.startDate)} — ${formatDate(sub.endDate)}\n${statusLabel(sub.endDate)}\n\nВыберите срок:`,
      extendDurationKeyboard(subId, clientId),
    );
  }

  @Action(/^subs:extend:(1m|3m|6m|1y):(\d+):(\d+)$/)
  async onSubExtendDuration(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const duration = ctx.match![1] as Duration;
    const subId = parseInt(ctx.match![2]);
    const clientId = parseInt(ctx.match![3]);
    const updated = await this.subscriptionsService.extend(subId, duration);
    const subs = await this.subscriptionsService.findByClient(clientId);
    await ctx.editMessageText(
      `✅ Подписка продлена до ${formatDate(updated.endDate)}.`,
      subscriptionListKeyboard(subs, clientId),
    );
  }

  @Action(/^subs:extend:custom:(\d+):(\d+)$/)
  async onSubExtendCustom(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const subscriptionId = parseInt(ctx.match![1]);
    const clientId = parseInt(ctx.match![2]);
    await ctx.scene.enter(CUSTOM_DATE_SCENE, { clientId, subscriptionId, mode: 'extend' });
  }

  @Action(/^subs:delete:(\d+):(\d+)$/)
  async onSubDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const subId = parseInt(ctx.match![1]);
    const clientId = parseInt(ctx.match![2]);
    const sub = await this.subscriptionsService.findOne(subId);
    await ctx.editMessageText(
      `🗑 Удалить подписку ${formatDate(sub.startDate)} — ${formatDate(sub.endDate)}?`,
      subscriptionDeleteConfirmKeyboard(subId, clientId),
    );
  }

  @Action(/^subs:delete:confirm:(\d+):(\d+)$/)
  async onSubDeleteConfirm(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const subId = parseInt(ctx.match![1]);
    const clientId = parseInt(ctx.match![2]);
    await this.subscriptionsService.remove(subId);
    const client = await this.clientsService.findOne(clientId);
    const subs = await this.subscriptionsService.findByClient(clientId);
    const text = `📋 Подписки — ${client.name}:` + (subs.length ? '' : '\n\nПодписок нет.');
    await ctx.editMessageText(text, subscriptionListKeyboard(subs, clientId));
  }
}
