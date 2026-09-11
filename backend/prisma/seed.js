const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with rich data...');

  // Clean existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.progressUpdate.deleteMany();
  await prisma.support.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.supportRequest.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.sponsorshipInterest.deleteMany();
  await prisma.sponsorProfile.deleteMany();
  await prisma.athleteProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.sport.deleteMany();

  // --- SPORTS ---
  const sports = await Promise.all([
    prisma.sport.create({ data: { name: 'Athletics', category: 'Track and Field' } }),
    prisma.sport.create({ data: { name: 'Swimming', category: 'Aquatics' } }),
    prisma.sport.create({ data: { name: 'Badminton', category: 'Racquet Sports' } }),
    prisma.sport.create({ data: { name: 'Wrestling', category: 'Combat Sports' } }),
    prisma.sport.create({ data: { name: 'Boxing', category: 'Combat Sports' } }),
    prisma.sport.create({ data: { name: 'Shooting', category: 'Precision Sports' } }),
    prisma.sport.create({ data: { name: 'Weightlifting', category: 'Strength Sports' } }),
    prisma.sport.create({ data: { name: 'Archery', category: 'Precision Sports' } }),
    prisma.sport.create({ data: { name: 'Table Tennis', category: 'Racquet Sports' } }),
    prisma.sport.create({ data: { name: 'Kabaddi', category: 'Indigenous Sports' } }),
  ]);

  const [athletics, swimming, badminton, wrestling, boxing, shooting, weightlifting, archery, tableTennis, kabaddi] = sports;

  const passwordHash = await bcrypt.hash('password123', 10);

  // --- ADMIN ---
  const admin = await prisma.user.create({
    data: { name: 'System Admin', email: 'admin@sportsphere.com', passwordHash, role: 'ADMIN' },
  });

  // --- SUPPORTERS ---
  await prisma.user.create({
    data: { name: 'Rajesh Mehta', email: 'supporter@demo.com', passwordHash, role: 'SUPPORTER', profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80' },
  });
  await prisma.user.create({
    data: { name: 'Priya Sharma', email: 'priya.supporter@demo.com', passwordHash, role: 'SUPPORTER' },
  });

  // --- SPONSORS ---
  const sponsor1 = await prisma.user.create({
    data: {
      name: 'TechCorp Lead',
      email: 'sponsor@techcorp.com',
      passwordHash,
      role: 'SPONSOR',
      sponsorProfile: {
        create: { organizationName: 'TechCorp Sports Initiative', contactPerson: 'Ananya Iyer', organizationType: 'Corporate CSR' }
      }
    },
  });
  await prisma.user.create({
    data: {
      name: 'GoSport Foundation',
      email: 'sponsor@gosport.org',
      passwordHash,
      role: 'SPONSOR',
      sponsorProfile: {
        create: { organizationName: 'GoSport Foundation', contactPerson: 'Nandan Kamath', organizationType: 'NGO' }
      }
    },
  });

  // =============================================
  // ATHLETES (10 diverse profiles)
  // =============================================

  // 1. Aarav Patil - Athletics (State level, Maharashtra)
  const aarav = await prisma.user.create({
    data: {
      name: 'Aarav Patil', email: 'aarav@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1526550517342-e086f3837548?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: athletics.id, discipline: '400m Sprint',
          state: 'Maharashtra', city: 'Mumbai',
          bio: 'State-level sprinter training under Coach Rajesh Yadav at Mumbai Athletics Academy. 4 years competitive experience. Aiming to break 48s in the 400m and qualify for nationals.',
          coachName: 'Rajesh Yadav', academyName: 'Mumbai Athletics Academy',
          currentGoal: 'Qualify for National Junior Athletics Championship 2026',
          publicVerificationSummary: 'Identity ✓ • Affiliation ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 2. Diya Nair - Swimming (National level, Kerala)
  const diya = await prisma.user.create({
    data: {
      name: 'Diya Nair', email: 'diya@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1518144591331-17a5dd71c477?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: swimming.id, discipline: '200m Freestyle',
          state: 'Kerala', city: 'Thiruvananthapuram',
          bio: 'National-level freestyle swimmer. Gold medalist at Kerala State Aquatics Championship. Training at SAI Trivandrum centre with a vision to represent India at Asian Games.',
          coachName: 'Sunitha Rao', academyName: 'SAI Trivandrum Aquatics',
          currentGoal: 'Medal at Senior National Aquatics Championship',
          publicVerificationSummary: 'Identity ✓ • Affiliation ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 3. Rohan Singh - Wrestling (District level, Haryana)
  const rohan = await prisma.user.create({
    data: {
      name: 'Rohan Singh', email: 'rohan@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: wrestling.id, discipline: 'Freestyle 74kg',
          state: 'Haryana', city: 'Sonipat',
          bio: 'District champion wrestler from Sonipat\'s wrestling heartland. Training at the legendary Chhatrasal Akhada tradition. Focused on qualifying for state-level tournaments.',
          coachName: 'Mahavir Phogat Jr.', academyName: 'Sonipat Wrestling Centre',
          currentGoal: 'Win Haryana State Wrestling Championship',
          publicVerificationSummary: 'Identity ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 4. Ananya Reddy - Badminton (State level, Telangana)
  const ananya = await prisma.user.create({
    data: {
      name: 'Ananya Reddy', email: 'ananya@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: badminton.id, discipline: 'Women\'s Singles',
          state: 'Telangana', city: 'Hyderabad',
          bio: 'Rising star in Hyderabad\'s badminton circuit. Trained at the Pullela Gopichand Academy feeder program. Consistent top-4 finishes at state-level tournaments.',
          coachName: 'Sai Praneeth B.', academyName: 'Gopichand Badminton Academy',
          currentGoal: 'Qualify for All India Junior Ranking Tournament',
          publicVerificationSummary: 'Identity ✓ • Affiliation ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 5. Vikram Choudhary - Boxing (National level, Rajasthan)
  const vikram = await prisma.user.create({
    data: {
      name: 'Vikram Choudhary', email: 'vikram@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1574680373038-f9b5c2a129ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: boxing.id, discipline: 'Light Welterweight 63.5kg',
          state: 'Rajasthan', city: 'Jaipur',
          bio: 'National bronze medalist in boxing. Trains at Army Sports Institute feeder program. Known for aggressive counter-punching style. Dreams of Olympic qualification.',
          coachName: 'Bhiwani Boxing Club Coach', academyName: 'Rajasthan Boxing Association',
          currentGoal: 'Gold at National Boxing Championship 2026',
          publicVerificationSummary: 'Identity ✓ • Affiliation ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 6. Meera Kumari - Shooting (State level, MP)
  const meera = await prisma.user.create({
    data: {
      name: 'Meera Kumari', email: 'meera@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: shooting.id, discipline: '10m Air Rifle',
          state: 'Madhya Pradesh', city: 'Bhopal',
          bio: 'Precision shooter specializing in 10m Air Rifle. Silver medalist at MP State Shooting Championship. Inspired by Abhinav Bindra\'s Olympic gold.',
          coachName: 'Jaspal Rana Academy Coach', academyName: 'MP State Shooting Academy',
          currentGoal: 'Qualify for National Shooting Championship',
          publicVerificationSummary: 'Identity ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 7. Arjun Das - Weightlifting (State level, Manipur)
  const arjun = await prisma.user.create({
    data: {
      name: 'Arjun Das', email: 'arjun@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: weightlifting.id, discipline: '67kg Category',
          state: 'Manipur', city: 'Imphal',
          bio: 'Following the proud tradition of Manipuri weightlifting. Gold at NE Zone championship. Training to break the junior national record in clean & jerk.',
          coachName: 'Kunjarani Devi', academyName: 'Manipur Weightlifting Centre',
          currentGoal: 'Break Junior National Record at Nationals 2026',
          publicVerificationSummary: 'Identity ✓ • Affiliation ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 8. Priya Sharma - Archery (District level, Jharkhand)
  const priyaA = await prisma.user.create({
    data: {
      name: 'Priya Sharma', email: 'priya.archer@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: archery.id, discipline: 'Recurve Bow',
          state: 'Jharkhand', city: 'Ranchi',
          bio: 'Tribal archer from Jharkhand, continuing the state\'s rich tradition in archery. Trained under Tata Archery Academy\'s grassroots program. First in her village to compete at district level.',
          coachName: 'Deepika Kumari\'s School Coach', academyName: 'Tata Archery Academy',
          currentGoal: 'Win Jharkhand State Archery Championship',
          publicVerificationSummary: 'Identity ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 9. Karan Joshi - Table Tennis (State level, Gujarat)
  const karan = await prisma.user.create({
    data: {
      name: 'Karan Joshi', email: 'karan@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: tableTennis.id, discipline: 'Men\'s Singles',
          state: 'Gujarat', city: 'Ahmedabad',
          bio: 'Gujarat state champion in table tennis. Known for his topspin forehand. Balancing competitive sports with engineering studies at NIT Surat.',
          coachName: 'Sharath Kamal Academy Coach', academyName: 'Gujarat TT Association',
          currentGoal: 'Represent Gujarat at National Games 2026',
          publicVerificationSummary: 'Identity ✓ • Achievement ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // 10. Suresh Kumar - Kabaddi (State level, Tamil Nadu)
  const suresh = await prisma.user.create({
    data: {
      name: 'Suresh Kumar', email: 'suresh@athlete.com', passwordHash, role: 'ATHLETE', profileImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80',
      athleteProfile: {
        create: {
          sportId: kabaddi.id, discipline: 'Raider',
          state: 'Tamil Nadu', city: 'Chennai',
          bio: 'Explosive raider from Chennai. State-level kabaddi champion. Dreams of making it to the Pro Kabaddi League. Known for his agility and do-or-die raids.',
          coachName: 'PKL Level Coach', academyName: 'Tamil Nadu Kabaddi Academy',
          currentGoal: 'Get scouted for Pro Kabaddi League Season 12',
          publicVerificationSummary: 'Identity ✓ • Affiliation ✓',
        }
      }
    },
    include: { athleteProfile: true }
  });

  // =============================================
  // ACHIEVEMENTS (with achievementLevel)
  // =============================================
  const achievementsData = [
    // Aarav - Athletics
    { athleteId: aarav.athleteProfile.id, title: 'Maharashtra State Championship Silver', competition: 'Maharashtra State Athletics Championship', event: '400m Sprint', position: '2nd Place', score: '48.7s', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    { athleteId: aarav.athleteProfile.id, title: 'Mumbai District Gold', competition: 'Mumbai District Athletics Meet', event: '400m Sprint', position: '1st Place', score: '49.2s', date: '2024', achievementLevel: 'DISTRICT', verificationStatus: 'VERIFIED' },
    // Diya - Swimming
    { athleteId: diya.athleteProfile.id, title: 'Kerala State Aquatics Gold', competition: 'Kerala State Aquatics Championship', event: '200m Freestyle', position: '1st Place', score: '2:05.3', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    { athleteId: diya.athleteProfile.id, title: 'National Junior Bronze', competition: 'National Junior Aquatics Championship', event: '200m Freestyle', position: '3rd Place', score: '2:04.1', date: '2025', achievementLevel: 'NATIONAL', verificationStatus: 'VERIFIED' },
    // Rohan - Wrestling
    { athleteId: rohan.athleteProfile.id, title: 'Sonipat District Wrestling Gold', competition: 'Sonipat District Wrestling Championship', event: 'Freestyle 74kg', position: '1st Place', date: '2025', achievementLevel: 'DISTRICT', verificationStatus: 'VERIFIED' },
    // Ananya - Badminton
    { athleteId: ananya.athleteProfile.id, title: 'Telangana State Semifinalist', competition: 'Telangana State Badminton Championship', event: 'Women\'s Singles', position: '3rd Place', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    { athleteId: ananya.athleteProfile.id, title: 'Hyderabad City Champion', competition: 'Hyderabad City Open', event: 'Women\'s Singles', position: '1st Place', date: '2024', achievementLevel: 'DISTRICT', verificationStatus: 'VERIFIED' },
    // Vikram - Boxing
    { athleteId: vikram.athleteProfile.id, title: 'National Boxing Bronze', competition: 'National Boxing Championship', event: 'Light Welterweight 63.5kg', position: '3rd Place', date: '2025', achievementLevel: 'NATIONAL', verificationStatus: 'VERIFIED' },
    { athleteId: vikram.athleteProfile.id, title: 'Rajasthan State Gold', competition: 'Rajasthan State Boxing Championship', event: 'Light Welterweight', position: '1st Place', date: '2024', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    // Meera - Shooting
    { athleteId: meera.athleteProfile.id, title: 'MP State Shooting Silver', competition: 'MP State Shooting Championship', event: '10m Air Rifle', position: '2nd Place', score: '628.5', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    // Arjun - Weightlifting
    { athleteId: arjun.athleteProfile.id, title: 'NE Zone Weightlifting Gold', competition: 'North East Zone Weightlifting Championship', event: '67kg Snatch + C&J', position: '1st Place', score: '280kg Total', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    // Priya A - Archery (PENDING_REVIEW)
    { athleteId: priyaA.athleteProfile.id, title: 'Ranchi District Archery Gold', competition: 'Ranchi District Archery Championship', event: 'Recurve Individual', position: '1st Place', score: '648/720', date: '2025', achievementLevel: 'DISTRICT', verificationStatus: 'PENDING_REVIEW' },
    // Karan - Table Tennis
    { athleteId: karan.athleteProfile.id, title: 'Gujarat State TT Champion', competition: 'Gujarat State Table Tennis Championship', event: 'Men\'s Singles', position: '1st Place', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    // Suresh - Kabaddi
    { athleteId: suresh.athleteProfile.id, title: 'Tamil Nadu State Kabaddi Gold', competition: 'Tamil Nadu State Kabaddi Championship', event: 'Senior Men', position: '1st Place (Team)', date: '2025', achievementLevel: 'STATE', verificationStatus: 'VERIFIED' },
    { athleteId: suresh.athleteProfile.id, title: 'Best Raider Award', competition: 'Tamil Nadu State Kabaddi Championship', event: 'Senior Men', position: 'Best Raider', date: '2025', achievementLevel: 'STATE', verificationStatus: 'PENDING_REVIEW' },
  ];

  // Create achievements and collect them for Verification linkage
  const createdAchievements = [];
  for (const ach of achievementsData) {
    const created = await prisma.achievement.create({ data: ach });
    createdAchievements.push(created);
  }

  // =============================================
  // SUPPORT REQUESTS (varied categories, amounts)
  // =============================================
  const sr1 = await prisma.supportRequest.create({
    data: {
      athleteId: aarav.athleteProfile.id,
      title: 'National Championship Travel Fund',
      description: 'Need support to cover travel, accommodation, and registration for the National Junior Athletics Championship in Delhi.',
      category: 'TRAVEL', targetAmount: 18000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 5200,
      budgetItems: { create: [
        { description: 'Tournament Registration', amount: 4000 },
        { description: 'Train Travel (Mumbai→Delhi→Mumbai)', amount: 8000 },
        { description: 'Accommodation (3 nights)', amount: 6000 },
      ]}
    }
  });

  const sr2 = await prisma.supportRequest.create({
    data: {
      athleteId: diya.athleteProfile.id,
      title: 'High-Performance Swimsuit & Training Gear',
      description: 'Professional-grade competition swimsuit and training equipment needed for national championship preparation. Current gear is worn out from 2 years of daily training.',
      category: 'EQUIPMENT', targetAmount: 35000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 12000,
      budgetItems: { create: [
        { description: 'Arena Competition Swimsuit', amount: 15000 },
        { description: 'Training Fins & Paddles', amount: 8000 },
        { description: 'Goggles (Competition + Training)', amount: 5000 },
        { description: 'Training Resistance Bands', amount: 7000 },
      ]}
    }
  });

  const sr3 = await prisma.supportRequest.create({
    data: {
      athleteId: rohan.athleteProfile.id,
      title: 'Wrestling Mat & Nutrition Support',
      description: 'Our village training centre needs a proper wrestling mat, and I need nutrition supplements to maintain weight category during intensive training.',
      category: 'TRAINING', targetAmount: 25000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 3500,
      budgetItems: { create: [
        { description: 'Practice Wrestling Mat', amount: 12000 },
        { description: 'Whey Protein (3 months)', amount: 8000 },
        { description: 'Dietary Supplements', amount: 5000 },
      ]}
    }
  });

  const sr4 = await prisma.supportRequest.create({
    data: {
      athleteId: ananya.athleteProfile.id,
      title: 'All India Junior Ranking Tournament Entry',
      description: 'Seeking support for participating in the All India Junior Ranking Tournament in Lucknow. This is crucial for getting a national ranking.',
      category: 'TOURNAMENT_REGISTRATION', targetAmount: 22000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 8500,
      budgetItems: { create: [
        { description: 'Tournament Registration', amount: 5000 },
        { description: 'Flight (Hyderabad→Lucknow→Hyderabad)', amount: 9000 },
        { description: 'Accommodation (4 nights)', amount: 8000 },
      ]}
    }
  });

  const sr5 = await prisma.supportRequest.create({
    data: {
      athleteId: vikram.athleteProfile.id,
      title: 'Olympic Boxing Camp Training Fee',
      description: 'Selected for a high-performance boxing training camp at NIS Patiala. Need support for the 2-month camp fees and equipment.',
      category: 'COACHING', targetAmount: 45000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 15000,
      budgetItems: { create: [
        { description: 'Camp Training Fee (2 months)', amount: 20000 },
        { description: 'Boxing Gloves (Competition Grade)', amount: 8000 },
        { description: 'Headguard & Mouthguard', amount: 5000 },
        { description: 'Travel to Patiala', amount: 7000 },
        { description: 'Accommodation Supplement', amount: 5000 },
      ]}
    }
  });

  const sr6 = await prisma.supportRequest.create({
    data: {
      athleteId: meera.athleteProfile.id,
      title: 'Air Rifle Pellets & Range Practice',
      description: 'Competition-grade pellets are expensive and I need consistent range practice time. Requesting support for 6 months of training supplies.',
      category: 'EQUIPMENT', targetAmount: 15000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 2000,
      budgetItems: { create: [
        { description: 'RWS R10 Match Pellets (20 tins)', amount: 8000 },
        { description: 'Range Booking (6 months)', amount: 5000 },
        { description: 'Shooting Jacket Repair', amount: 2000 },
      ]}
    }
  });

  const sr7 = await prisma.supportRequest.create({
    data: {
      athleteId: arjun.athleteProfile.id,
      title: 'National Championship Preparation',
      description: 'Need support to attend the Senior National Weightlifting Championship. Coming from Imphal, travel costs are significant.',
      category: 'TRAVEL', targetAmount: 28000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 9000,
      budgetItems: { create: [
        { description: 'Flight (Imphal→Pune→Imphal)', amount: 14000 },
        { description: 'Accommodation (5 nights)', amount: 8000 },
        { description: 'Special Diet (Competition Week)', amount: 6000 },
      ]}
    }
  });

  const sr8 = await prisma.supportRequest.create({
    data: {
      athleteId: priyaA.athleteProfile.id,
      title: 'Competition Bow Upgrade',
      description: 'Currently using a basic training bow. Need a competition-grade recurve bow to be competitive at state level. This will be a game-changer for my scores.',
      category: 'EQUIPMENT', targetAmount: 40000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 0,
      budgetItems: { create: [
        { description: 'WNS Forged Elite Recurve Riser', amount: 22000 },
        { description: 'Competition Limbs', amount: 12000 },
        { description: 'Arrows (1 dozen)', amount: 6000 },
      ]}
    }
  });

  const sr9 = await prisma.supportRequest.create({
    data: {
      athleteId: karan.athleteProfile.id,
      title: 'National Games Preparation Camp',
      description: 'Selected to represent Gujarat at National Games. Need support for dedicated 1-month preparation camp and equipment upgrade.',
      category: 'TRAINING', targetAmount: 20000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 6500,
      budgetItems: { create: [
        { description: 'Butterfly Tenergy Rubbers (2 sets)', amount: 8000 },
        { description: 'Training Camp Fee', amount: 7000 },
        { description: 'Sparring Partner Fee', amount: 5000 },
      ]}
    }
  });

  const sr10 = await prisma.supportRequest.create({
    data: {
      athleteId: suresh.athleteProfile.id,
      title: 'PKL Trial Preparation & Fitness',
      description: 'Pro Kabaddi League trials are in 3 months. Need intensive fitness training, physiotherapy for knee recovery, and travel to trial venues.',
      category: 'RECOVERY_PHYSIOTHERAPY', targetAmount: 30000, approvalStatus: 'APPROVED', lifecycleStatus: 'ACTIVE', amountSupported: 4000,
      budgetItems: { create: [
        { description: 'Physio Sessions (12 sessions)', amount: 12000 },
        { description: 'Gym Membership (3 months)', amount: 6000 },
        { description: 'Travel to PKL Trial Venues', amount: 8000 },
        { description: 'Knee Brace (Medical Grade)', amount: 4000 },
      ]}
    }
  });

  // =============================================
  // VERIFICATION RECORDS (Polymorphic)
  // =============================================
  // Helper to map athlete profiles and their verification states
  const athleteProfiles = [
    { profile: aarav.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'VERIFIED' },
    { profile: diya.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'VERIFIED' },
    { profile: rohan.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'NOT_SUBMITTED' },
    { profile: ananya.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'VERIFIED' },
    { profile: vikram.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'VERIFIED' },
    { profile: meera.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'NOT_SUBMITTED' },
    { profile: arjun.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'VERIFIED' },
    { profile: priyaA.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'NOT_SUBMITTED' },
    { profile: karan.athleteProfile, identityStatus: 'VERIFIED', affiliationStatus: 'NOT_SUBMITTED' },
    { profile: suresh.athleteProfile, identityStatus: 'PENDING_REVIEW', affiliationStatus: 'PENDING_REVIEW' },
  ];

  // Seed IDENTITY + ATHLETE_AFFILIATION per athlete
  for (const ap of athleteProfiles) {
    await prisma.verification.create({
      data: {
        entityType: 'AthleteProfile',
        entityId: ap.profile.id,
        category: 'IDENTITY',
        status: ap.identityStatus,
        verifiedBy: ap.identityStatus === 'VERIFIED' ? admin.id : null,
        verifiedAt: ap.identityStatus === 'VERIFIED' ? new Date() : null,
      }
    });
    await prisma.verification.create({
      data: {
        entityType: 'AthleteProfile',
        entityId: ap.profile.id,
        category: 'ATHLETE_AFFILIATION',
        status: ap.affiliationStatus,
        verifiedBy: ap.affiliationStatus === 'VERIFIED' ? admin.id : null,
        verifiedAt: ap.affiliationStatus === 'VERIFIED' ? new Date() : null,
      }
    });
  }

  // Seed ACHIEVEMENT verification per achievement (mirrors Achievement.verificationStatus)
  for (const ach of createdAchievements) {
    await prisma.verification.create({
      data: {
        entityType: 'Achievement',
        entityId: ach.id,
        category: 'ACHIEVEMENT',
        status: ach.verificationStatus,
        verifiedBy: ach.verificationStatus === 'VERIFIED' ? admin.id : null,
        verifiedAt: ach.verificationStatus === 'VERIFIED' ? new Date() : null,
      }
    });
  }

  // Seed SUPPORT_NEED verification per support request
  const supportRequests = [sr1, sr2, sr3, sr4, sr5, sr6, sr7, sr8, sr9, sr10];
  for (let i = 0; i < supportRequests.length; i++) {
    const sr = supportRequests[i];
    // Most are VERIFIED since they're already APPROVED; last two are PENDING_REVIEW for admin queue
    const status = i >= 8 ? 'PENDING_REVIEW' : 'VERIFIED';
    await prisma.verification.create({
      data: {
        entityType: 'SupportRequest',
        entityId: sr.id,
        category: 'SUPPORT_NEED',
        status: status,
        verifiedBy: status === 'VERIFIED' ? admin.id : null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      }
    });
  }

  console.log('✅ Seed completed!');
  console.log('   Created: 10 athletes, 15 achievements, 10 support requests');
  console.log('   Created: Verification records (IDENTITY, AFFILIATION, ACHIEVEMENT, SUPPORT_NEED)');
  console.log('   Pending review items: 2 achievements, 2 support needs, 1 identity, 1 affiliation');
  console.log('');
  console.log('Demo accounts (all use password: password123):');
  console.log('  Admin:     admin@sportsphere.com');
  console.log('  Supporter: supporter@demo.com');
  console.log('  Athlete:   aarav@athlete.com (and 9 more)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
