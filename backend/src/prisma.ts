import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasourceUrl: process.env.DATABASE_URL } : undefined);

export default prisma;
