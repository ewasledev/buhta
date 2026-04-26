import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [SubscriptionsModule],
  providers: [NotificationsService],
})
export class NotificationsModule {}
