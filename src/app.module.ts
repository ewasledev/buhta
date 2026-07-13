import { existsSync } from 'fs';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { ClientsModule } from './clients/clients.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BotModule } from './bot/bot.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebApiModule } from './webapi/webapi.module';

const webappDist = join(process.cwd(), 'webapp/dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SettingsModule,
    ClientsModule,
    SubscriptionsModule,
    BotModule,
    NotificationsModule,
    WebApiModule,
    ...(existsSync(webappDist)
      ? [
          ServeStaticModule.forRoot({
            rootPath: webappDist,
            exclude: ['/api/(.*)'],
            serveStaticOptions: {
              setHeaders: (res, path) => {
                if (path.endsWith('index.html')) {
                  res.setHeader('Cache-Control', 'no-cache');
                } else {
                  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
              },
            },
          }),
        ]
      : []),
  ],
})
export class AppModule {}
