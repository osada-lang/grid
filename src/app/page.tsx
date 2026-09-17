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

  return <MainStoreList initialAgencies={agencies || []} />;
}
