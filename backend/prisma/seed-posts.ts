import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌟 Seeding athlete journey posts and cheers...');

  const athletes = await prisma.athleteProfile.findMany({
    include: { user: true, sport: true }
  });

  const supporters = await prisma.user.findMany({
    where: { role: 'SUPPORTER' }
  });

  const aarav = athletes.find(a => a.user.name.includes('Aarav'));
  const diya = athletes.find(a => a.user.name.includes('Diya'));
  const rohan = athletes.find(a => a.user.name.includes('Rohan'));
  const ananya = athletes.find(a => a.user.name.includes('Ananya'));
  const vikram = athletes.find(a => a.user.name.includes('Vikram'));
  const arjun = athletes.find(a => a.user.name.includes('Arjun'));

  const postsData = [
    {
      athlete: aarav || athletes[0],
      content: '⚡ Personal Best Alert! Clocked 46.4s in the 400m sprint trials at Balewadi Stadium this morning. Huge thanks to everyone supporting my campaign for the new carbon spike shoes — they are making a massive difference in corner acceleration! 🏃💨 #TrackAndField #RoadToNationals #SportSphere',
      mediaUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      athlete: diya || athletes[1],
      content: '🏊 Early 5:00 AM session done: 4,000m aerobic endurance drill at the aquatic center. Working specifically on breath control in the final 50m of butterfly stroke. Grateful to the SportSphere community for cheering me on every lap! 💙',
      mediaUrl: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    },
    {
      athlete: rohan || athletes[2],
      content: '🤼 Mud, sweat, and relentless mat drills at the akhada. Tested out tactical counter-attacks for the 74kg freestyle national qualifiers. Recovery session with ice baths now. Your backing keeps the dream alive! 🇮🇳🔥',
      mediaUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80',
      createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000), // 14 hours ago
    },
    {
      athlete: ananya || athletes[3],
      content: '🏸 Smashes on point today! Reached the quarterfinals at the All-India Junior Badminton Championship. The high tension restringing kit funded by my supporters arrived just in time for tomorrow’s morning match! 🏸✨',
      mediaUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      athlete: vikram || athletes[4],
      content: '🥊 12 rounds of heavy bag work and technical sparring. Hand speed is feeling sharper than ever ahead of the state boxing championship. Step by step, punch by punch. 💥👊',
      mediaUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80',
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 1.5 days ago
    },
    {
      athlete: arjun || athletes[5],
      content: '🏋️ Locked in a new clean & jerk benchmark: 175kg! Focusing intensely on stability and hip explosion. Thank you to my sponsors and backers for fueling the journey to the National Games! ⚡',
      mediaUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    },
  ];

  for (const item of postsData) {
    if (!item.athlete) continue;

    // Check if post exists to avoid duplicate seeding
    const existing = await prisma.post.findFirst({
      where: {
        athleteId: item.athlete.id,
        content: item.content,
      }
    });

    if (!existing) {
      const createdPost = await prisma.post.create({
        data: {
          athleteId: item.athlete.id,
          content: item.content,
          mediaUrl: item.mediaUrl,
          createdAt: item.createdAt,
        }
      });

      // Add a couple of initial cheers from supporters
      for (const sup of supporters) {
        try {
          await prisma.cheer.create({
            data: {
              postId: createdPost.id,
              userId: sup.id,
            }
          });
        } catch {}
      }
    }
  }

  const postCount = await prisma.post.count();
  const cheerCount = await prisma.cheer.count();
  console.log(`✅ Posts seeded successfully! Total posts: ${postCount}, Total cheers: ${cheerCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
