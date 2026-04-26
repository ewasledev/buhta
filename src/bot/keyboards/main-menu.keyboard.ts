import { Markup } from 'telegraf';

export const mainMenuKeyboard = () =>
  Markup.inlineKeyboard([[Markup.button.callback('👥 Клиенты', 'clients:list')]]);
