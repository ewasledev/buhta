import { Module } from '@nestjs/common';
import { XuiModule } from '../xui/xui.module';
import { HealthController } from './controllers/health.controller';
import { SessionController } from './controllers/session.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { InboundsController } from './controllers/inbounds.controller';
import { PanelClientsController } from './controllers/panel-clients.controller';
import { ServerController } from './controllers/server.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [XuiModule],
  controllers: [
    HealthController,
    SessionController,
    DashboardController,
    InboundsController,
    PanelClientsController,
    ServerController,
  ],
  providers: [DashboardService],
})
export class WebApiModule {}
