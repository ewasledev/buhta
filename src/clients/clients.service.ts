import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { subscriptions: { orderBy: { endDate: 'desc' } } },
    });
    if (!client) throw new NotFoundException(`Клиент ${id} не найден`);
    return client;
  }

  async create(dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Клиент "${dto.name}" уже существует`);
    return this.prisma.client.create({ data: { name: dto.name } });
  }

  async update(id: number, dto: UpdateClientDto) {
    await this.findOne(id);
    const duplicate = await this.prisma.client.findUnique({ where: { name: dto.name } });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(`Клиент "${dto.name}" уже существует`);
    }
    return this.prisma.client.update({ where: { id }, data: { name: dto.name } });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.client.delete({ where: { id } });
  }
}
