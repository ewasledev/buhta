import { Markup } from 'telegraf';
import { Subscription } from '@prisma/client';
import { formatDate, statusLabel } from '../../common/utils/date.utils';

export const subscriptionListKeyboard = (subs: Subscription[], clientId: number) =>
  Markup.inlineKeyboard([
    ...subs.map((s) => [
      Markup.button.callback(
        `${formatDate(s.startDate)} — ${formatDate(s.endDate)} ${statusLabel(s.endDate)}`,
        `subs:detail:${s.id}:${clientId}`,
      ),
    ]),
    [Markup.button.callback('➕ Добавить', `subs:add:${clientId}`)],
    [Markup.button.callback('← Назад', `clients:detail:${clientId}`)],
  ]);

export const subscriptionDetailKeyboard = (subId: number, clientId: number) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Продлить', `subs:extend:${subId}:${clientId}`),
      Markup.button.callback('🗑 Удалить', `subs:delete:${subId}:${clientId}`),
    ],
    [Markup.button.callback('← Назад', `subs:list:${clientId}`)],
  ]);

export const subscriptionDeleteConfirmKeyboard = (subId: number, clientId: number) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Подтвердить', `subs:delete:confirm:${subId}:${clientId}`),
      Markup.button.callback('❌ Отмена', `subs:detail:${subId}:${clientId}`),
    ],
  ]);

export const addDurationKeyboard = (clientId: number) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('1 месяц', `subs:add:1m:${clientId}`),
      Markup.button.callback('3 месяца', `subs:add:3m:${clientId}`),
    ],
    [
      Markup.button.callback('6 месяцев', `subs:add:6m:${clientId}`),
      Markup.button.callback('1 год', `subs:add:1y:${clientId}`),
    ],
    [Markup.button.callback('📅 Своя дата', `subs:add:custom:${clientId}`)],
    [Markup.button.callback('← Назад', `subs:list:${clientId}`)],
  ]);

export const extendDurationKeyboard = (subId: number, clientId: number) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('1 месяц', `subs:extend:1m:${subId}:${clientId}`),
      Markup.button.callback('3 месяца', `subs:extend:3m:${subId}:${clientId}`),
    ],
    [
      Markup.button.callback('6 месяцев', `subs:extend:6m:${subId}:${clientId}`),
      Markup.button.callback('1 год', `subs:extend:1y:${subId}:${clientId}`),
    ],
    [Markup.button.callback('📅 Своя дата', `subs:extend:custom:${subId}:${clientId}`)],
    [Markup.button.callback('← Назад', `subs:detail:${subId}:${clientId}`)],
  ]);
