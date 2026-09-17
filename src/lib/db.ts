import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  try {
    const rawUrl = process.env.DATABASE_URL;
    let dbUrl: string;

    if (rawUrl && !rawUrl.startsWith('file:./dev.db')) {
      dbUrl = rawUrl.startsWith('file:') ? rawUrl : `file:${rawUrl}`;
    } else {
      const possiblePaths = [
        path.resolve(process.cwd(), 'dev.db'),
        path.join(__dirname, 'dev.db'),
        path.join(__dirname, '..', 'dev.db'),
        '/tmp/dev.db',
      ];
      const foundPath = possiblePaths.find((p) => fs.existsSync(p)) || path.resolve(process.cwd(), 'dev.db');
      dbUrl = `file:${foundPath}`;
    }

    const adapter = new PrismaLibSql({ url: dbUrl });
    return new PrismaClient({ adapter });
  } catch (err) {
    console.error('Failed to create PrismaClient instance:', err);
    return new Proxy({} as any, {
      get() {
        return () => Promise.reject(new Error('PrismaClient disabled'));
      },
    });
  }
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    try {
      if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
      }
      return Reflect.get(globalForPrisma.prisma, prop, receiver);
    } catch {
      return new Proxy({} as any, {
        get() {
          return () => Promise.reject(new Error('Prisma access error'));
        },
      });
    }
  },
});





