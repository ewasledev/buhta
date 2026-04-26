import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Duration = '1m' | '3m' | '6m' | '1y';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  findByClient(clientId: number) {
    return this.prisma.subscription.findMany({
      where: { clientId },
      orderBy: { endDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException(`Подписка ${id} не найдена`);
    return sub;
  }

  getActive(clientId: number) {
    return this.prisma.subscription.findFirst({
      where: { clientId, endDate: { gte: new Date() } },
      orderBy: { endDate: 'desc' },
    });
  }

  resolveEndDate(from: Date, duration: Duration | Date): Date {
    if (duration instanceof Date) return duration;
    const d = new Date(from);
    switch (duration) {
      case '1m': d.setMonth(d.getMonth() + 1); break;
      case '3m': d.setMonth(d.getMonth() + 3); break;
      case '6m': d.setMonth(d.getMonth() + 6); break;
      case '1y': d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
  }

  create(clientId: number, duration: Duration | Date) {
    const startDate = new Date();
    const endDate = this.resolveEndDate(startDate, duration);
    return this.prisma.subscription.create({ data: { clientId, startDate, endDate } });
  }

  async extend(id: number, duration: Duration | Date) {
    const sub = await this.findOne(id);
    const endDate = this.resolveEndDate(sub.endDate, duration);
    return this.prisma.subscription.update({ where: { id }, data: { endDate } });
  }

  async findExpiredVip() {
    const now = new Date();
    const clients = await this.prisma.client.findMany({
      where: { isVip: true },
      include: { subscriptions: { orderBy: { endDate: 'desc' }, take: 1 } },
    });
    return clients
      .filter((c) => c.subscriptions[0] && c.subscriptions[0].endDate < now)
      .map((c) => ({ client: c, subscription: c.subscriptions[0] }));
  }

  findExpiringOn(date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    return this.prisma.subscription.findMany({
      where: { endDate: { gte: start, lte: end } },
      include: { client: true },
      orderBy: { client: { name: 'asc' } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.subscription.delete({ where: { id } });
  }
}
