import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InitDataGuard } from '../guards/init-data.guard';
import { XuiExceptionFilter } from '../filters/xui-exception.filter';
import { ClientLinkService } from '../services/client-link.service';

@Controller('api/bot-clients')
@UseGuards(InitDataGuard)
@UseFilters(XuiExceptionFilter)
export class BotClientsController {
  constructor(private readonly linkService: ClientLinkService) {}

  @Get()
  list() {
    return this.linkService.listBotClients();
  }

  @Post(':id/link')
  link(@Param('id', ParseIntPipe) id: number, @Body() body: { xuiEmail: string }) {
    if (!body?.xuiEmail?.trim()) throw new BadRequestException('Поле xuiEmail обязательно');
    return this.linkService.link(id, body.xuiEmail.trim());
  }

  @Delete(':id/link')
  unlink(@Param('id', ParseIntPipe) id: number) {
    return this.linkService.unlink(id);
  }
}
