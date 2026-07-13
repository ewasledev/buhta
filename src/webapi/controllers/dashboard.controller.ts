import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import { InitDataGuard } from '../guards/init-data.guard';
import { XuiExceptionFilter } from '../filters/xui-exception.filter';
import { DashboardService } from '../services/dashboard.service';

@Controller('api/dashboard')
@UseGuards(InitDataGuard)
@UseFilters(XuiExceptionFilter)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getDashboard() {
    return this.dashboard.getDashboard();
  }
}
