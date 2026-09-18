import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  console.log('PostgreSQL database connected.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
