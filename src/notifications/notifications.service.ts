import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronTime } from 'cron';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SettingsService } from '../settings/settings.service';
import { formatDate } from '../common/utils/date.utils';

export const NOTIFICATION_JOB = 'notification-check';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const stored = await this.settingsService.getNotificationCron();
    if (stored !== this.settingsService.DEFAULT_CRON) {
      try {
        const job = this.schedulerRegistry.getCronJob(NOTIFICATION_JOB);
        job.stop();
        job.setTime(new CronTime(stored));
        job.start();
        this.logger.log(`Cron schedule restored from DB: ${stored}`);
      } catch {
        this.logger.warn('Could not restore cron schedule — job not registered yet');
      }
    }
  }

  @Cron('0 9 * * *', { name: NOTIFICATION_JOB })
  async checkExpiringSubscriptions() {
    const adminId = parseInt(this.config.getOrThrow('ADMIN_TELEGRAM_ID'), 10);

    const renewed = await this.renewVipSubscriptions();

    const today    = new Date();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

    const [expiringToday, expiringTomorrow] = await Promise.all([
      this.subscriptionsService.findExpiringOn(today),
      this.subscriptionsService.findExpiringOn(tomorrow),
    ]);

    const filteredToday    = expiringToday.filter((s) => !s.client.isVip);
    const filteredTomorrow = expiringTomorrow.filter((s) => !s.client.isVip);

    if (!renewed.length && !filteredToday.length && !filteredTomorrow.length) return;

    const lines: string[] = [];

    if (renewed.length) {
      lines.push('🔄 Автопродлено (VIP):');
      for (const { clientName, newEndDate } of renewed) {
        lines.push(`• ${clientName} — до ${formatDate(newEndDate)}`);
      }
    }

    if (filteredToday.length) {
      if (lines.length) lines.push('');
      lines.push('⚠️ Подписка истекает СЕГОДНЯ:');
      for (const s of filteredToday) {
        lines.push(`• ${s.client.name} (до ${formatDate(s.endDate)})`);
      }
    }

    if (filteredTomorrow.length) {
      if (lines.length) lines.push('');
      lines.push('🔔 Подписка истекает ЗАВТРА:');
      for (const s of filteredTomorrow) {
        lines.push(`• ${s.client.name} (до ${formatDate(s.endDate)})`);
      }
    }

    try {
      await this.bot.telegram.sendMessage(adminId, lines.join('\n'));
    } catch (err) {
      this.logger.error('Failed to send expiry notification', err);
    }
  }

  private async renewVipSubscriptions() {
    const expired = await this.subscriptionsService.findExpiredVip();
    const results: { clientName: string; newEndDate: Date }[] = [];

    for (const { client, subscription: sub } of expired) {
      const durationMs = sub.endDate.getTime() - sub.startDate.getTime();
      const newEndDate = new Date(sub.endDate.getTime() + durationMs);
      await this.subscriptionsService.extend(sub.id, newEndDate);
      results.push({ clientName: client.name, newEndDate });
    }

    return results;
  }
}
