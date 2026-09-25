import { prisma } from '@/lib/db';
import MainStoreList from './MainStoreList';

export const revalidate = 0;

export default async function Home() {
  let agencies: any[] = [];
  try {
    const dbAgencies = await prisma.agency.findMany({
      include: {
        _count: {
          select: { stores: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const unassignedStoreCount = await prisma.store.count({
      where: { agencyId: null },
    });

    agencies = dbAgencies.map((a) => ({
      id: a.id,
      name: a.name,
      _count: { stores: a._count.stores },
    }));

    if (unassignedStoreCount > 0) {
      agencies.push({
        id: 'unassigned',
        name: '（代理店未割り当て）',
        _count: { stores: unassignedStoreCount },
      });
    }
  } catch (error) {
    console.error('Failed to fetch agencies in Home:', error);
  }

  return <MainStoreList initialAgencies={agencies} />;
}
