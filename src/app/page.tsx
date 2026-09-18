import { prisma } from '@/lib/db';
import MainStoreList from './MainStoreList';

export const revalidate = 0;

export default async function Home() {
  let agencies: any[] = [];
  try {
    const stores = await prisma.store.findMany({
      select: { area: true, id: true },
    });

    const areaCountMap = new Map<string, number>();
    for (const s of stores) {
      const areaName = s.area && s.area.trim() !== '' ? s.area : '（直営・未設定）';
      areaCountMap.set(areaName, (areaCountMap.get(areaName) || 0) + 1);
    }

    agencies = Array.from(areaCountMap.entries()).map(([name, count]) => ({
      id: encodeURIComponent(name),
      name,
      _count: { stores: count },
    }));
  } catch (error) {
    console.error('Failed to fetch store groups in Home:', error);
  }

  return <MainStoreList initialAgencies={agencies} />;
}
