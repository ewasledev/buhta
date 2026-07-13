import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { SessionController } from './controllers/session.controller';

@Module({
  controllers: [HealthController, SessionController],
})
export class WebApiModule {}
