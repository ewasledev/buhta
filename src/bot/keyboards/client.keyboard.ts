import { Markup } from 'telegraf';
import { Client } from '@prisma/client';

export const clientListKeyboard = (clients: Client[]) =>
  Markup.inlineKeyboard([
    ...clients.map((c) => [Markup.button.callback(c.name, `clients:detail:${c.id}`)]),
    [Markup.button.callback('➕ Добавить клиента', 'clients:create')],
  ]);

export const clientDetailKeyboard = (clientId: number) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Подписки', `subs:list:${clientId}`),
      Markup.button.callback('✏️ Переименовать', `clients:edit:${clientId}`),
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
