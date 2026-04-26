import { Ctx, Message, On, Wizard, WizardStep } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { ClientsService } from '../../../clients/clients.service';
import { AdminGuard } from '../../guards/admin.guard';
import { BotContext } from '../../context.interface';
import { clientListKeyboard } from '../../keyboards/client.keyboard';

export const CLIENT_CREATE_SCENE = 'CLIENT_CREATE';

@Wizard(CLIENT_CREATE_SCENE)
@UseGuards(AdminGuard)
export class ClientCreateScene {
  constructor(private readonly clientsService: ClientsService) {}

  @WizardStep(0)
  async step0(@Ctx() ctx: BotContext) {
    await ctx.reply('Введите имя клиента:\n/cancel — отменить');
    await ctx.wizard.next();
  }

  @WizardStep(1)
  @On('text')
  async step1(@Ctx() ctx: BotContext, @Message('text') text: string) {
    if (text === '/cancel') {
      await ctx.scene.leave();
      const clients = await this.clientsService.findAll();
      await ctx.reply('Создание отменено.', clientListKeyboard(clients));
      return;
    }

    const name = text.trim();
    if (!name) {
      await ctx.reply('Имя не может быть пустым. Введите имя клиента:');
      return;
    }

    try {
      const client = await this.clientsService.create({ name });
      await ctx.scene.leave();
      const clients = await this.clientsService.findAll();
      await ctx.reply(`✅ Клиент "${client.name}" создан.`, clientListKeyboard(clients));
    } catch {
      await ctx.reply(`❌ Клиент с именем "${name}" уже существует. Введите другое имя:`);
    }
  }
}
