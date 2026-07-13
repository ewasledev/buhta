import { Module } from '@nestjs/common';
import { XuiModule } from '../xui/xui.module';
import { ClientsModule } from '../clients/clients.module';
import { HealthController } from './controllers/health.controller';
import { SessionController } from './controllers/session.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { InboundsController } from './controllers/inbounds.controller';
import { PanelClientsController } from './controllers/panel-clients.controller';
import { ServerController } from './controllers/server.controller';
import { BotClientsController } from './controllers/bot-clients.controller';
import { DashboardService } from './services/dashboard.service';
import { ClientLinkService } from './services/client-link.service';

@Module({
  imports: [XuiModule, ClientsModule],
  controllers: [
    HealthController,
    SessionController,
    DashboardController,
    InboundsController,
    PanelClientsController,
    ServerController,
    BotClientsController,
  ],
  providers: [DashboardService, ClientLinkService],
})
export class WebApiModule {}
