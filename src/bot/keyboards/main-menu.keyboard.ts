import { Markup } from 'telegraf';

export const mainMenuKeyboard = (webAppUrl?: string) =>
  Markup.inlineKeyboard([
    ...(webAppUrl ? [[Markup.button.webApp('🖥 Открыть панель', webAppUrl)]] : []),
    [Markup.button.callback('👥 Клиенты', 'clients:list')],
    [Markup.button.callback('📊 Информация', 'clients:info')],
    [Markup.button.callback('⚙️ Расписание', 'schedule:view')],
  ]);
