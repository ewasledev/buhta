import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { formatDate } from '../common/utils/date.utils';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 9 * * *')
  async checkExpiringSubscriptions() {
    const adminId = parseInt(this.config.getOrThrow('ADMIN_TELEGRAM_ID'), 10);

    const today    = new Date();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

    const [expiringToday, expiringTomorrow] = await Promise.all([
      this.subscriptionsService.findExpiringOn(today),
      this.subscriptionsService.findExpiringOn(tomorrow),
    ]);

    if (!expiringToday.length && !expiringTomorrow.length) return;

    const lines: string[] = [];

    if (expiringToday.length) {
      lines.push('⚠️ Подписка истекает СЕГОДНЯ:');
      for (const s of expiringToday) {
        lines.push(`• ${s.client.name} (до ${formatDate(s.endDate)})`);
      }
    }

    if (expiringTomorrow.length) {
      if (lines.length) lines.push('');
      lines.push('🔔 Подписка истекает ЗАВТРА:');
      for (const s of expiringTomorrow) {
        lines.push(`• ${s.client.name} (до ${formatDate(s.endDate)})`);
      }
    }

    try {
      await this.bot.telegram.sendMessage(adminId, lines.join('\n'));
    } catch (err) {
      this.logger.error('Failed to send expiry notification', err);
    }
  }
}
