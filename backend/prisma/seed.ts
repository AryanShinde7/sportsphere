import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // 1. Create Sports
  const athletics = await prisma.sport.upsert({
    where: { name: 'Athletics' },
    update: {},
    create: { name: 'Athletics', category: 'Track and Field' },
  });

  const swimming = await prisma.sport.upsert({
    where: { name: 'Swimming' },
    update: {},
    create: { name: 'Swimming', category: 'Water Sports' },
  });

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  
  // Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sportsphere.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@sportsphere.com',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // Demo Supporter
  const supporter = await prisma.user.upsert({
    where: { email: 'supporter@demo.com' },
    update: {},
    create: {
      name: 'Demo Supporter',
      email: 'supporter@demo.com',
      passwordHash,
      role: 'SUPPORTER',
    },
  });

  // Demo Sponsor
  const sponsorUser = await prisma.user.upsert({
    where: { email: 'sponsor@techcorp.com' },
    update: {},
    create: {
      name: 'TechCorp Lead',
      email: 'sponsor@techcorp.com',
      passwordHash,
      role: 'SPONSOR',
      sponsorProfile: {
        create: {
          organizationName: 'TechCorp Sports Initiative',
          contactPerson: 'Jane Doe',
        }
      }
    },
  });

  // Aarav Patil (Athlete)
  const aaravUser = await prisma.user.upsert({
    where: { email: 'aarav@athlete.com' },
    update: {},
    create: {
      name: 'Aarav Patil',
      email: 'aarav@athlete.com',
      passwordHash,
      role: 'ATHLETE',
      athleteProfile: {
        create: {
          sportId: athletics.id,
          discipline: '400m',
          state: 'Maharashtra',
          city: 'Mumbai',
          bio: 'Passionate sprinter aiming for national glory.',
          currentGoal: 'Prepare for National Junior Athletics Championship',
          publicVerificationSummary: 'Identity Verified, State Affiliation Verified',
        }
      }
    },
    include: {
      athleteProfile: true
    }
  });

  // 3. Add Achievements for Aarav
  if (aaravUser.athleteProfile) {
    await prisma.achievement.create({
      data: {
        athleteId: aaravUser.athleteProfile.id,
        title: 'State Championship Silver',
        competition: 'State Championship',
        event: '400m Sprint',
        position: '2nd place',
        verificationStatus: 'VERIFIED',
      }
    });

    // 4. Create Support Request for Aarav
    await prisma.supportRequest.create({
      data: {
        athleteId: aaravUser.athleteProfile.id,
        title: 'National Championship Travel',
        description: 'Need support covering travel and registration for the upcoming National Junior Athletics Championship.',
        category: 'TRAVEL',
        targetAmount: 18000,
        approvalStatus: 'APPROVED',
        lifecycleStatus: 'ACTIVE',
        amountSupported: 0,
        budgetItems: {
          create: [
            { description: 'Registration', amount: 4000 },
            { description: 'Travel (Train/Flight)', amount: 8000 },
            { description: 'Accommodation (3 nights)', amount: 6000 },
          ]
        }
      }
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
