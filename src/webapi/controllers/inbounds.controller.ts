import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InitDataGuard } from '../guards/init-data.guard';
import { XuiExceptionFilter } from '../filters/xui-exception.filter';
import { XuiService } from '../../xui/xui.service';
import { CreateInboundDto, UpdateInboundDto } from '../dto/inbound.dto';

@Controller('api/inbounds')
@UseGuards(InitDataGuard)
@UseFilters(XuiExceptionFilter)
export class InboundsController {
  constructor(private readonly xui: XuiService) {}

  @Get()
  list() {
    return this.xui.listInbounds();
  }

  @Get('options')
  options() {
    return this.xui.inboundOptions();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.xui.getInbound(id);
  }

  @Post()
  create(@Body() dto: CreateInboundDto) {
    this.validate(dto);
    return this.xui.addInbound(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInboundDto) {
    this.validate(dto);
    return this.xui.updateInbound(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.xui.deleteInbound(id);
  }

  @Post(':id/enable')
  setEnable(@Param('id', ParseIntPipe) id: number, @Body() body: { enable: boolean }) {
    if (typeof body?.enable !== 'boolean') throw new BadRequestException('Поле enable обязательно');
    return this.xui.setInboundEnable(id, body.enable);
  }

  @Post(':id/reset-traffic')
  resetTraffic(@Param('id', ParseIntPipe) id: number) {
    return this.xui.resetInboundTraffic(id);
  }

  @Post(':id/del-all-clients')
  delAllClients(@Param('id', ParseIntPipe) id: number) {
    return this.xui.delAllInboundClients(id);
  }

  private validate(dto: CreateInboundDto) {
    if (!dto?.remark?.trim()) throw new BadRequestException('Поле remark обязательно');
    if (!Number.isInteger(dto.port) || dto.port < 1 || dto.port > 65535) {
      throw new BadRequestException('Некорректный порт');
    }
    if (!dto.protocol?.trim()) throw new BadRequestException('Поле protocol обязательно');
  }
}
