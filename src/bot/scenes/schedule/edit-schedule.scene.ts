import { Ctx, Message, On, Wizard, WizardStep } from 'nestjs-telegraf';
import { UseGuards } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronTime } from 'cron';
import { isValidCron } from 'cron-validator';
import { SettingsService } from '../../../settings/settings.service';
import { AdminGuard } from '../../guards/admin.guard';
import { BotContext } from '../../context.interface';

export const EDIT_SCHEDULE_SCENE = 'EDIT_SCHEDULE';

@Wizard(EDIT_SCHEDULE_SCENE)
@UseGuards(AdminGuard)
export class EditScheduleScene {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @WizardStep(0)
  async step0(@Ctx() ctx: BotContext) {
    const current = await this.settingsService.getNotificationCron();
    await ctx.reply(
      `⚙️ Текущее расписание: <code>${current}</code>\n\n` +
        'Введите новое cron-выражение (5 полей):\n' +
        'Формат: <code>минута час день месяц день_недели</code>\n' +
        'Пример: <code>0 9 * * *</code> — ежедневно в 09:00\n\n' +
        '/cancel — отменить',
      { parse_mode: 'HTML' },
    );
    await ctx.wizard.next();
  }

  @WizardStep(1)
  @On('text')
  async step1(@Ctx() ctx: BotContext, @Message('text') text: string) {
    if (text === '/cancel') {
      await ctx.scene.leave();
      await ctx.reply('Отменено.');
      return;
    }

    const expr = text.trim();

    if (!isValidCron(expr)) {
      await ctx.reply(
        '❌ Невалидное cron-выражение.\n\n' +
          'Формат: <code>минута час день месяц день_недели</code>\n' +
          'Пример: <code>0 9 * * *</code>\n\n' +
          'Попробуйте ещё раз или /cancel для отмены.',
        { parse_mode: 'HTML' },
      );
      return;
    }

    await this.settingsService.setNotificationCron(expr);

    try {
      const job = this.schedulerRegistry.getCronJob('notification-check');
      job.stop();
      job.setTime(new CronTime(expr));
      job.start();
    } catch {
      // job may not exist yet (first run before first tick)
    }

    await ctx.scene.leave();
    await ctx.reply(
      `✅ Расписание обновлено.\n\nНовое: <code>${expr}</code>`,
      { parse_mode: 'HTML' },
    );
  }
}
