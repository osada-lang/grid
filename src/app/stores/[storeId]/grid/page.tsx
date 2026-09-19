import React from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getStoreGridData } from '@/lib/get-store-grid-data';
import GridDashboard from './GridDashboard';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeId: string }>;
}): Promise<Metadata> {
  const { storeId } = await params;
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });
    return {
      title: store?.name ? `${store.name} - グリッド順位レポート` : 'グリッド順位レポート',
    };
  } catch {
    return {
      title: 'グリッド順位レポート',
    };
  }
}

export default async function GridPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  let initialData = null;

  try {
    initialData = await getStoreGridData(storeId);
  } catch (error) {
    console.error('Failed to get store grid data in GridPage:', error);
  }

  return <GridDashboard storeId={storeId} initialData={initialData} />;
}
