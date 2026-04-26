import { Markup } from 'telegraf';
import { Client } from '@prisma/client';

export const clientListKeyboard = (clients: Client[]) =>
  Markup.inlineKeyboard([
    ...clients.map((c) => [
      Markup.button.callback(
        c.isVip ? `⭐ ${c.name}` : c.name,
        `clients:detail:${c.id}`,
      ),
    ]),
    [Markup.button.callback('➕ Добавить клиента', 'clients:create')],
    [Markup.button.callback('← Главное меню', 'menu:back')],
  ]);

export const clientDetailKeyboard = (clientId: number, isVip: boolean) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Подписки', `subs:list:${clientId}`),
      Markup.button.callback('✏️ Переименовать', `clients:edit:${clientId}`),
    ],
    [Markup.button.callback('💰 Изменить стоимость', `clients:price:${clientId}`)],
    [
      isVip
        ? Markup.button.callback('✖ Убрать VIP', `clients:vip:${clientId}`)
        : Markup.button.callback('⭐ Сделать VIP', `clients:vip:${clientId}`),
    ],
    [
      Markup.button.callback('🗑 Удалить', `clients:delete:${clientId}`),
      Markup.button.callback('← Назад', 'clients:list'),
    ],
  ]);

export const clientDeleteConfirmKeyboard = (clientId: number) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Подтвердить', `clients:delete:confirm:${clientId}`),
      Markup.button.callback('❌ Отмена', `clients:detail:${clientId}`),
    ],
  ]);
