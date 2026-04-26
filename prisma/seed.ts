import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = [
  {
    name: 'Настя Саммер',
    isVip: true,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T08:32:24.767Z'), endDate: new Date('2026-04-26T19:00:00.000Z') },
    ],
  },
  {
    name: 'Костя + Полина + Сестра',
    isVip: true,
    price: 800,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:03:00.415Z'), endDate: new Date('2026-05-26T09:03:00.415Z') },
    ],
  },
  {
    name: 'Ян',
    isVip: false,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:22:13.635Z'), endDate: new Date('2027-04-26T09:22:13.635Z') },
    ],
  },
  {
    name: 'Танюня',
    isVip: true,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:22:48.716Z'), endDate: new Date('2026-05-26T09:22:48.716Z') },
    ],
  },
  {
    name: 'Яна Хоризон',
    isVip: false,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:23:13.199Z'), endDate: new Date('2026-05-26T09:23:13.199Z') },
    ],
  },
  {
    name: 'Лиза',
    isVip: false,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:23:34.322Z'), endDate: new Date('2026-05-26T09:23:34.322Z') },
    ],
  },
  {
    name: 'Китана',
    isVip: false,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:30:46.783Z'), endDate: new Date('2026-06-26T09:30:46.783Z') },
    ],
  },
  {
    name: 'Иван',
    isVip: true,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:37:27.559Z'), endDate: new Date('2026-05-26T09:37:27.559Z') },
    ],
  },
  {
    name: 'Геля',
    isVip: true,
    price: 0,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:39:00.744Z'), endDate: new Date('2026-05-26T09:39:00.744Z') },
    ],
  },
  {
    name: 'Кеп + Ульяна + Мать Ульяны',
    isVip: false,
    price: 300,
    subscriptions: [
      { startDate: new Date('2026-04-26T09:49:17.294Z'), endDate: new Date('2026-04-30T19:00:00.000Z') },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  for (const { subscriptions, ...clientData } of data) {
    const client = await prisma.client.upsert({
      where: { name: clientData.name },
      update: { isVip: clientData.isVip, price: clientData.price },
      create: clientData,
    });

    const existingCount = await prisma.subscription.count({ where: { clientId: client.id } });
    if (existingCount === 0) {
      await prisma.subscription.createMany({
        data: subscriptions.map((s) => ({ ...s, clientId: client.id })),
      });
    }

    console.log(`  ✓ ${client.name}`);
  }

  console.log(`\nDone. Seeded ${data.length} clients.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
