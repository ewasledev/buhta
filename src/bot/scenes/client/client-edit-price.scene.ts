import { Ctx, Message, On, Wizard, WizardStep } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { ClientsService } from '../../../clients/clients.service';
import { AdminGuard } from '../../guards/admin.guard';
import { BotContext, WizardState } from '../../context.interface';
import { clientDetailKeyboard } from '../../keyboards/client.keyboard';

export const CLIENT_EDIT_PRICE_SCENE = 'CLIENT_EDIT_PRICE';

@Wizard(CLIENT_EDIT_PRICE_SCENE)
@UseGuards(AdminGuard)
export class ClientEditPriceScene {
  constructor(private readonly clientsService: ClientsService) {}

  @WizardStep(0)
  async step0(@Ctx() ctx: BotContext) {
    const { clientId } = ctx.scene.state as WizardState;
    const client = await this.clientsService.findOne(clientId!);
    await ctx.reply(
      `Текущая стоимость: ${client.price} ₽\n\nВведите новую стоимость (целое число):\n/cancel — отменить`,
    );
    await ctx.wizard.next();
  }

  @WizardStep(1)
  @On('text')
  async step1(@Ctx() ctx: BotContext, @Message('text') text: string) {
    const { clientId } = ctx.scene.state as WizardState;

    if (text === '/cancel') {
      await ctx.scene.leave();
      const client = await this.clientsService.findOne(clientId!);
      await ctx.reply('Изменение отменено.', clientDetailKeyboard(clientId!, client.isVip));
      return;
    }

    const price = parseInt(text.trim(), 10);
    if (isNaN(price) || price < 0) {
      await ctx.reply('❌ Введите целое неотрицательное число. Например: 5000');
      return;
    }

    const client = await this.clientsService.updatePrice(clientId!, price);
    await ctx.scene.leave();
    await ctx.reply(`✅ Стоимость обновлена: ${price} ₽`, clientDetailKeyboard(client.id, client.isVip));
  }
}
