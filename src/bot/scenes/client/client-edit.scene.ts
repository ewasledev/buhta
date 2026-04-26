import { Ctx, Message, On, Wizard, WizardStep } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { ClientsService } from '../../../clients/clients.service';
import { AdminGuard } from '../../guards/admin.guard';
import { BotContext, WizardState } from '../../context.interface';
import { clientDetailKeyboard } from '../../keyboards/client.keyboard';

export const CLIENT_EDIT_SCENE = 'CLIENT_EDIT';

@Wizard(CLIENT_EDIT_SCENE)
@UseGuards(AdminGuard)
export class ClientEditScene {
  constructor(private readonly clientsService: ClientsService) {}

  @WizardStep(0)
  async step0(@Ctx() ctx: BotContext) {
    const { clientId } = ctx.scene.state as WizardState;
    const client = await this.clientsService.findOne(clientId!);
    await ctx.reply(`Текущее имя: ${client.name}\n\nВведите новое имя:\n/cancel — отменить`);
    await ctx.wizard.next();
  }

  @WizardStep(1)
  @On('text')
  async step1(@Ctx() ctx: BotContext, @Message('text') text: string) {
    const { clientId } = ctx.scene.state as WizardState;

    if (text === '/cancel') {
      await ctx.scene.leave();
      const client = await this.clientsService.findOne(clientId!);
      await ctx.reply(`Переименование отменено.`, clientDetailKeyboard(clientId!));
      void client;
      return;
    }

    const name = text.trim();
    if (!name) {
      await ctx.reply('Имя не может быть пустым. Введите новое имя:');
      return;
    }

    try {
      const updated = await this.clientsService.update(clientId!, { name });
      await ctx.scene.leave();
      await ctx.reply(`✅ Клиент переименован в "${updated.name}".`, clientDetailKeyboard(updated.id));
    } catch {
      await ctx.reply(`❌ Клиент с именем "${name}" уже существует. Введите другое имя:`);
    }
  }
}
