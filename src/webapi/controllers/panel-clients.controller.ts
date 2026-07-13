import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InitDataGuard } from '../guards/init-data.guard';
import { XuiExceptionFilter } from '../filters/xui-exception.filter';
import { XuiService } from '../../xui/xui.service';
import { BulkAdjustDto, CreatePanelClientDto, UpdatePanelClientDto } from '../dto/panel-client.dto';

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

@Controller('api/panel-clients')
@UseGuards(InitDataGuard)
@UseFilters(XuiExceptionFilter)
export class PanelClientsController {
  constructor(private readonly xui: XuiService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('inboundId') inboundId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.xui.listClientsPaged({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 25,
      search: q,
      filter: status,
      inboundId: inboundId ? Number(inboundId) : undefined,
      sort,
    });
  }

  @Get('onlines')
  onlines() {
    return this.xui.onlines();
  }

  @Post('bulk-adjust')
  bulkAdjust(@Body() dto: BulkAdjustDto) {
    if (!Array.isArray(dto?.emails) || dto.emails.length === 0) {
      throw new BadRequestException('Список emails пуст');
    }
    if (dto.addDays === undefined && dto.addBytes === undefined) {
      throw new BadRequestException('Укажите addDays или addBytes');
    }
    return this.xui.bulkAdjust(dto);
  }

  @Post('cleanup')
  cleanup(@Body() body: { mode: 'depleted' | 'orphans' }) {
    if (body?.mode === 'depleted') return this.xui.delDepleted();
    if (body?.mode === 'orphans') return this.xui.delOrphans();
    throw new BadRequestException('mode: depleted | orphans');
  }

  @Get(':email')
  async detail(@Param('email') email: string) {
    const [client, traffic, lastOnline, links] = await Promise.allSettled([
      this.xui.getPanelClient(email),
      this.xui.clientTraffic(email),
      this.xui.lastOnline(),
      this.xui.clientLinks(email),
    ]);
    const lastOnlineMap = settled(lastOnline);
    return {
      client: settled(client),
      traffic: settled(traffic),
      lastOnline: lastOnlineMap ? (lastOnlineMap[email] ?? null) : null,
      links: settled(links),
      linkedBotClient: await this.findLinkedBotClient(email),
    };
  }

  @Post()
  create(@Body() dto: CreatePanelClientDto) {
    if (!dto?.client?.email?.trim()) throw new BadRequestException('Поле client.email обязательно');
    if (!Array.isArray(dto.inboundIds) || dto.inboundIds.length === 0) {
      throw new BadRequestException('Выберите хотя бы один инбаунд');
    }
    return this.xui.addPanelClient(dto);
  }

  @Put(':email')
  update(@Param('email') email: string, @Body() dto: UpdatePanelClientDto) {
    return this.xui.updatePanelClient(email, dto);
  }

  @Delete(':email')
  async remove(@Param('email') email: string) {
    const result = await this.xui.deletePanelClient(email);
    await this.clearBotClientLink(email);
    return result;
  }

  @Post(':email/reset-traffic')
  resetTraffic(@Param('email') email: string) {
    return this.xui.resetClientTraffic(email);
  }

  @Post(':email/attach')
  attach(@Param('email') email: string, @Body() body: { inboundIds: number[] }) {
    if (!Array.isArray(body?.inboundIds) || body.inboundIds.length === 0) {
      throw new BadRequestException('Список inboundIds пуст');
    }
    return this.xui.attachClient(email, body.inboundIds);
  }

  @Post(':email/detach')
  detach(@Param('email') email: string, @Body() body: { inboundIds: number[] }) {
    if (!Array.isArray(body?.inboundIds) || body.inboundIds.length === 0) {
      throw new BadRequestException('Список inboundIds пуст');
    }
    return this.xui.detachClient(email, body.inboundIds);
  }

  @Get(':email/ips')
  ips(@Param('email') email: string) {
    return this.xui.clientIps(email);
  }

  @Delete(':email/ips')
  clearIps(@Param('email') email: string) {
    return this.xui.clearClientIps(email);
  }

  /** Появится в задаче связки (Task 5): поиск клиента бота по xuiEmail. */
  protected async findLinkedBotClient(_email: string): Promise<unknown> {
    return null;
  }

  /** Появится в задаче связки (Task 5): очистка xuiEmail при удалении клиента панели. */
  protected async clearBotClientLink(_email: string): Promise<void> {
    return undefined;
  }
}
