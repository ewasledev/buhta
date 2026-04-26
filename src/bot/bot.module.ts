import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { session } from 'telegraf';
import { ClientsModule } from '../clients/clients.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BotUpdate } from './bot.update';
import { AdminGuard } from './guards/admin.guard';
import { ClientCreateScene } from './scenes/client/client-create.scene';
import { ClientEditScene } from './scenes/client/client-edit.scene';
import { CustomDateScene } from './scenes/subscription/custom-date.scene';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow('TELEGRAM_BOT_TOKEN'),
        middlewares: [session()],
      }),
    }),
    ClientsModule,
    SubscriptionsModule,
  ],
  providers: [
    BotUpdate,
    AdminGuard,
    ClientCreateScene,
    ClientEditScene,
    CustomDateScene,
  ],
})
export class BotModule {}
