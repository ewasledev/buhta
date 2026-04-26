import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  readonly NOTIFICATION_CRON_KEY = 'notification_cron';
  readonly DEFAULT_CRON = '0 9 * * *';

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getNotificationCron(): Promise<string> {
    return (await this.get(this.NOTIFICATION_CRON_KEY)) ?? this.DEFAULT_CRON;
  }

  async setNotificationCron(expr: string): Promise<void> {
    await this.set(this.NOTIFICATION_CRON_KEY, expr);
  }
}
