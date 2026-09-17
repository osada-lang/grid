import { prisma } from '@/lib/db';
import MainStoreList from './MainStoreList';

export const revalidate = 0;

export default async function Home() {
  let agencies: any[] = [];
  try {
    agencies = await prisma.agency.findMany({
      include: {
        _count: {
          select: { stores: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Failed to fetch agencies in Home:', error);
  }

  // もし代理店がなければデフォルト直営店をフォールバック表示
  if (!agencies || agencies.length === 0) {
    agencies = [
      {
        id: 'agency-direct-001',
        name: '（直営店）',
        _count: { stores: 1 },
      },
    ];
  }

  return <MainStoreList initialAgencies={agencies} />;
}
