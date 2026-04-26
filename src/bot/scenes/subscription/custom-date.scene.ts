import { Ctx, Message, On, Wizard, WizardStep } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { SubscriptionsService } from '../../../subscriptions/subscriptions.service';
import { AdminGuard } from '../../guards/admin.guard';
import { BotContext, WizardState } from '../../context.interface';
import { subscriptionListKeyboard } from '../../keyboards/subscription.keyboard';
import { formatDate, isDateInFuture, parseDate } from '../../../common/utils/date.utils';

export const CUSTOM_DATE_SCENE = 'CUSTOM_DATE';

@Wizard(CUSTOM_DATE_SCENE)
@UseGuards(AdminGuard)
export class CustomDateScene {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @WizardStep(0)
  async step0(@Ctx() ctx: BotContext) {
    await ctx.reply('📅 Введите дату окончания подписки в формате ДД.ММ.ГГГГ:\n/cancel — отменить');
    await ctx.wizard.next();
  }

  @WizardStep(1)
  @On('text')
  async step1(@Ctx() ctx: BotContext, @Message('text') text: string) {
    const { clientId, subscriptionId, mode } = ctx.scene.state as WizardState;

    if (text === '/cancel') {
      await ctx.scene.leave();
      const subs = await this.subscriptionsService.findByClient(clientId!);
      await ctx.reply('Отменено.', subscriptionListKeyboard(subs, clientId!));
      return;
    }

    const date = parseDate(text);
    if (!date) {
      await ctx.reply('❌ Неверный формат. Введите дату в формате ДД.ММ.ГГГГ:');
      return;
    }

    if (!isDateInFuture(date)) {
      await ctx.reply('❌ Дата должна быть в будущем. Введите дату в формате ДД.ММ.ГГГГ:');
      return;
    }

    if (mode === 'add') {
      await this.subscriptionsService.create(clientId!, date);
    } else {
      await this.subscriptionsService.extend(subscriptionId!, date);
    }

    await ctx.scene.leave();
    const subs = await this.subscriptionsService.findByClient(clientId!);
    const action = mode === 'add' ? 'добавлена' : 'продлена';
    await ctx.reply(
      `✅ Подписка ${action} до ${formatDate(date)}.`,
      subscriptionListKeyboard(subs, clientId!),
    );
  }
}
