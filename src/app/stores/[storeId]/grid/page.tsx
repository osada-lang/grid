import React from 'react';
import { getStoreGridData } from '@/lib/get-store-grid-data';
import GridDashboard from './GridDashboard';

export const revalidate = 0;

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

