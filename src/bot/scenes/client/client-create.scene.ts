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

    const allClients = await this.clientsService.findAll();
    if (allClients.some((c) => c.name === name)) {
      await ctx.reply(`❌ Клиент с именем "${name}" уже существует. Введите другое имя:`);
      return;
    }

    (ctx.wizard.state as any).clientName = name;
    await ctx.reply('Введите стоимость (целое число, например 5000):\n/cancel — отменить');
    await ctx.wizard.next();
  }

  @WizardStep(2)
  @On('text')
  async step2(@Ctx() ctx: BotContext, @Message('text') text: string) {
    if (text === '/cancel') {
      await ctx.scene.leave();
      const clients = await this.clientsService.findAll();
      await ctx.reply('Создание отменено.', clientListKeyboard(clients));
      return;
    }

    const price = parseInt(text.trim(), 10);
    if (isNaN(price) || price < 0) {
      await ctx.reply('❌ Введите целое неотрицательное число. Например: 5000');
      return;
    }

    const name = (ctx.wizard.state as any).clientName as string;
    try {
      const client = await this.clientsService.create({ name, price });
      await ctx.scene.leave();
      const clients = await this.clientsService.findAll();
      await ctx.reply(`✅ Клиент "${client.name}" создан (стоимость: ${price} ₽).`, clientListKeyboard(clients));
    } catch {
      await ctx.scene.leave();
      const clients = await this.clientsService.findAll();
      await ctx.reply('❌ Ошибка при создании клиента.', clientListKeyboard(clients));
    }
  }
}
