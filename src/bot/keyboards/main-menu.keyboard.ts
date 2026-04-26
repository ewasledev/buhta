import { Markup } from 'telegraf';

export const mainMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('👥 Клиенты', 'clients:list')],
    [Markup.button.callback('📊 Информация', 'clients:info')],
    [Markup.button.callback('⚙️ Расписание', 'schedule:view')],
  ]);
