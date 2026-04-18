import { db } from './client';
import { boostDefinitions, listings, reviews, sits, users } from './schema';
import { count } from 'drizzle-orm';

export async function seedDatabase() {
  // Only seed on a fresh database
  const [{ value }] = await db.select({ value: count() }).from(listings);
  if (value > 0) return;

  // ── Boost definitions ────────────────────────────────────────────────────────
  await db.insert(boostDefinitions).values([
    { key: 'tier_upgrade', label: 'Tier Upgrade',   description: 'Offer a premium sitter tier',  icon: 'star.fill',        sortOrder: 1 },
    { key: 'food_shop',    label: 'Food Shop',       description: 'Cover the cost of pet food',   icon: 'cart.fill',        sortOrder: 2 },
    { key: 'transport',    label: 'Transport',       description: 'Cover travel costs',            icon: 'car.fill',         sortOrder: 3 },
    { key: 'gift',         label: 'Gift',            description: 'Send a thank-you gift',         icon: 'gift.fill',        sortOrder: 4 },
    { key: 'custom',       label: 'Custom Perk',     description: 'Add your own perk',             icon: 'plus.circle.fill', sortOrder: 5 },
  ]).onConflictDoNothing();

  // ── Users ────────────────────────────────────────────────────────────────────
  await db.insert(users).values([
    {
      externalId:   'mock-owner-1',
      name:         'Sophie Clarke',
      avatarUrl:    'https://i.pravatar.cc/150?img=47',
      role:         'owner',
      bio:          'Dog mum and interior designer based in London. I travel for work every few months and need a warm, responsible sitter for Bella. Our home is comfortable and well-equipped — you\'ll have the place entirely to yourself.',
      rating:       4.9,
      reviewCount:  23,
      occupation:   'Interior Designer',
      location:     'London, UK',
    },
    {
      externalId:   'mock-sitter-1',
      name:         'James Harwood',
      avatarUrl:    'https://i.pravatar.cc/150?img=12',
      role:         'sitter',
      sitterTier:   'paid',
      bio:          'Experienced pet sitter with 5+ years and 80+ completed sits. I treat every home and pet as if they were my own.',
      rating:       5.0,
      reviewCount:  81,
    },
    {
      externalId:   'mock-owner-2',
      name:         'Jean-Pierre Moreau',
      avatarUrl:    'https://i.pravatar.cc/150?img=53',
      role:         'owner',
      bio:          'Retired chef living between Paris and Provence. Luna and Mochi are gentle, curious cats who adore company. My farmhouse has a pool, a proper kitchen, and lavender as far as the eye can see.',
      rating:       4.8,
      reviewCount:  17,
      occupation:   'Retired Chef',
      location:     'Provence, France',
    },
    {
      externalId:   'mock-owner-3',
      name:         'Elena Rodriguez',
      avatarUrl:    'https://i.pravatar.cc/150?img=32',
      role:         'owner',
      bio:          'Architect and slow travel enthusiast. Cleo has lived in three countries and loves meeting new people. My homes are designed for comfort — you\'ll never want to leave.',
      rating:       4.95,
      reviewCount:  31,
      occupation:   'Architect',
      location:     'Barcelona, Spain',
    },
    {
      externalId:   'mock-owner-4',
      name:         'Marcus Williams',
      avatarUrl:    'https://i.pravatar.cc/150?img=13',
      role:         'owner',
      bio:          'Film producer splitting time between New York and Sydney. Archie and Milo are energetic Labradors who need daily walks and a lot of love. In return you get world-class views and a very well-stocked fridge.',
      rating:       4.7,
      reviewCount:  14,
      occupation:   'Film Producer',
      location:     'New York, USA',
    },
    {
      externalId:   'mock-owner-5',
      name:         'Anika van den Berg',
      avatarUrl:    'https://i.pravatar.cc/150?img=38',
      role:         'owner',
      bio:          'Marine biologist and frequent traveller. Pip the rabbit is sociable, litter-trained, and very easy to care for. The canal house is in one of Amsterdam\'s most beautiful streets.',
      rating:       5.0,
      reviewCount:  9,
      occupation:   'Marine Biologist',
      location:     'Amsterdam, Netherlands',
    },
    {
      externalId:   'mock-owner-6',
      name:         'Yuki Tanaka',
      avatarUrl:    'https://i.pravatar.cc/150?img=45',
      role:         'owner',
      bio:          'Photographer and travel blogger based in Tokyo. Soba is a gentle Shiba Inu who loves quiet mornings and evening walks through the neighbourhood.',
      rating:       4.85,
      reviewCount:  12,
      occupation:   'Photographer',
      location:     'Tokyo, Japan',
    },
  ]).onConflictDoNothing();

  // ── Listings ─────────────────────────────────────────────────────────────────
  const mockListings = [
    // 1 — Kensington, London (owner 1 = Sophie)
    {
      ownerId:      1,
      title:        'Sunlit Kensington Flat',
      description:  'A bright, beautifully furnished two-bedroom flat nestled in the heart of London\'s most elegant neighbourhood. High ceilings, original cornicing, and a private garden make this a rare find. Bella is a three-year-old Golden Retriever who loves morning walks in Holland Park and is brilliant with strangers. She\'ll greet you every morning like you\'ve been away for a year.',
      address:      '14 Holland Park Ave, London W11',
      latitude:     51.5074,
      longitude:    -0.2001,
      city:         'London',
      country:      'UK',
      bedrooms:     2,
      bathrooms:    1,
      amenities:    JSON.stringify(['wifi', 'garden', 'parking', 'washer', 'workspace']),
      petCount:     1,
      petTypes:     JSON.stringify(['dog']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Bella', breed: 'Golden Retriever', age: 3, photoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400' },
      ]),
    },
    // 2 — Provence, France (owner 3 = Jean-Pierre)
    {
      ownerId:      3,
      title:        'Provençal Stone Farmhouse',
      description:  'Charming 18th-century stone farmhouse surrounded by lavender fields and vineyards. The property has a private heated pool, a wood-burning fireplace, and a kitchen that would make any cook weep with joy. Luna (5, tortoiseshell) and Mochi (3, white shorthair) are indoor cats who are utterly content basking in sunbeams and will happily curl up on your lap every evening.',
      address:      'Route de Gordes, Luberon, Provence',
      latitude:     43.8367,
      longitude:    5.3106,
      city:         'Provence',
      country:      'France',
      bedrooms:     4,
      bathrooms:    2,
      amenities:    JSON.stringify(['pool', 'garden', 'wifi', 'fireplace', 'parking', 'bbq', 'workspace']),
      petCount:     2,
      petTypes:     JSON.stringify(['cat', 'cat']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
        'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Luna',  breed: 'Tortoiseshell', age: 5, photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400' },
        { name: 'Mochi', breed: 'White Shorthair', age: 3, photoUrl: 'https://images.unsplash.com/photo-1573865526182-bef0d0bc5d30?w=400' },
      ]),
    },
    // 3 — Tribeca, New York (owner 5 = Marcus)
    {
      ownerId:      5,
      title:        'Tribeca Loft with Rooftop',
      description:  'Jaw-dropping industrial loft in New York\'s most coveted neighbourhood. Soaring ceilings, exposed brick, and a private rooftop terrace with views across Lower Manhattan. Max is a three-year-old Dachshund with more personality than most humans — great on a lead and an excellent judge of character.',
      address:      '56 Franklin St, Tribeca, New York',
      latitude:     40.7195,
      longitude:    -74.0089,
      city:         'New York',
      country:      'USA',
      bedrooms:     2,
      bathrooms:    2,
      amenities:    JSON.stringify(['wifi', 'rooftop', 'gym', 'workspace', 'washer', 'parking']),
      petCount:     1,
      petTypes:     JSON.stringify(['dog']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Max', breed: 'Miniature Dachshund', age: 3, photoUrl: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400' },
      ]),
    },
    // 4 — Bondi Beach, Sydney (owner 5 = Marcus)
    {
      ownerId:      5,
      title:        'Bondi Beach House',
      description:  'Steps from one of the world\'s most iconic beaches, this light-filled three-bedroom house has unobstructed ocean views from the first floor terrace. Archie (4, yellow Lab) and Milo (2, chocolate Lab) are best friends — they need two walks a day and absolutely love the beach. They swim, they fetch, they\'ll steal your heart.',
      address:      '3 Campbell Parade, Bondi Beach, Sydney',
      latitude:     -33.8915,
      longitude:    151.2767,
      city:         'Sydney',
      country:      'Australia',
      bedrooms:     3,
      bathrooms:    2,
      amenities:    JSON.stringify(['beach access', 'wifi', 'bbq', 'parking', 'outdoor shower']),
      petCount:     2,
      petTypes:     JSON.stringify(['dog', 'dog']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Archie', breed: 'Yellow Labrador', age: 4, photoUrl: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=400' },
        { name: 'Milo',   breed: 'Chocolate Labrador', age: 2, photoUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400' },
      ]),
    },
    // 5 — Gion, Kyoto (owner 4 = Elena)
    {
      ownerId:      4,
      title:        'Kyoto Machiya Townhouse',
      description:  'A beautifully restored traditional wooden townhouse (machiya) in the historic Gion district. Tatami rooms, a serene courtyard garden, and walking distance from some of Kyoto\'s most spectacular temples. Hana is a five-year-old Ragdoll cat — impossibly fluffy, very gentle, and accustomed to quiet surroundings.',
      address:      'Hanamikoji-dori, Gion, Kyoto',
      latitude:     35.0037,
      longitude:    135.7767,
      city:         'Kyoto',
      country:      'Japan',
      bedrooms:     2,
      bathrooms:    1,
      amenities:    JSON.stringify(['wifi', 'garden', 'workspace', 'onsen nearby', 'washer']),
      petCount:     1,
      petTypes:     JSON.stringify(['cat']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Hana', breed: 'Ragdoll', age: 5, photoUrl: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400' },
      ]),
    },
    // 6 — Oia, Santorini (owner 4 = Elena)
    {
      ownerId:      4,
      title:        'Santorini Clifftop Villa',
      description:  'Iconic whitewashed villa perched on the caldera cliffs of Oia, with a private infinity pool and uninterrupted views of the Aegean sunset. Nikos is an elegant, self-sufficient rescue cat who has lived here for four years — he knows every inch of the terrace and will keep you company on warm evenings.',
      address:      'Oia, Santorini, Cyclades',
      latitude:     36.4618,
      longitude:    25.3753,
      city:         'Santorini',
      country:      'Greece',
      bedrooms:     3,
      bathrooms:    2,
      amenities:    JSON.stringify(['infinity pool', 'wifi', 'sea view', 'terrace', 'parking']),
      petCount:     1,
      petTypes:     JSON.stringify(['cat']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Nikos', breed: 'Greek Shorthair (Rescue)', age: 4, photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400' },
      ]),
    },
    // 7 — Park Slope, Brooklyn (owner 5 = Marcus)
    {
      ownerId:      5,
      title:        'Brooklyn Brownstone',
      description:  'A classic Park Slope brownstone with original details — tin ceilings, hardwood floors, and a private back garden that blooms spectacularly every summer. Biscuit is a four-year-old Spaniel who adores the neighbourhood parks. Pepper, the tuxedo cat, is more independent but will claim your lap by day three.',
      address:      '245 7th Ave, Park Slope, Brooklyn',
      latitude:     40.6690,
      longitude:    -73.9796,
      city:         'Brooklyn',
      country:      'USA',
      bedrooms:     3,
      bathrooms:    2,
      amenities:    JSON.stringify(['garden', 'wifi', 'washer', 'parking', 'fireplace', 'workspace']),
      petCount:     2,
      petTypes:     JSON.stringify(['dog', 'cat']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Biscuit', breed: 'Cocker Spaniel', age: 4, photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400' },
        { name: 'Pepper',  breed: 'Tuxedo Cat',     age: 6, photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400' },
      ]),
    },
    // 8 — New Town, Edinburgh (owner 1 = Sophie)
    {
      ownerId:      1,
      title:        'Edinburgh New Town Apartment',
      description:  'Georgian elegance in Edinburgh\'s most sought-after neighbourhood. This first-floor apartment on Heriot Row has original shutters, a working fireplace, and views of Queen Street Gardens. Hamish is a three-year-old Border Collie — highly intelligent, loves long walks up Arthur\'s Seat, and the friendliest dog you\'ll ever meet.',
      address:      '12 Heriot Row, Edinburgh EH3',
      latitude:     55.9567,
      longitude:    -3.2007,
      city:         'Edinburgh',
      country:      'UK',
      bedrooms:     2,
      bathrooms:    1,
      amenities:    JSON.stringify(['wifi', 'fireplace', 'workspace', 'washer', 'central location']),
      petCount:     1,
      petTypes:     JSON.stringify(['dog']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Hamish', breed: 'Border Collie', age: 3, photoUrl: 'https://images.unsplash.com/photo-1503256207526-0d5d80fa2f47?w=400' },
      ]),
    },
    // 9 — Eixample, Barcelona (owner 4 = Elena)
    {
      ownerId:      4,
      title:        'Barcelona Eixample Penthouse',
      description:  'A sun-drenched penthouse apartment with panoramic rooftop terrace and outdoor pool, set within a modernista building in the heart of the Eixample. Cleo is a seven-year-old Bengal cat — athletic, chatty, and endlessly entertaining. She has a complex inner world and will make sure you know about it.',
      address:      'Carrer de Provença 248, Eixample, Barcelona',
      latitude:     41.3937,
      longitude:    2.1628,
      city:         'Barcelona',
      country:      'Spain',
      bedrooms:     3,
      bathrooms:    2,
      amenities:    JSON.stringify(['terrace', 'wifi', 'pool', 'gym', 'workspace', 'parking']),
      petCount:     1,
      petTypes:     JSON.stringify(['cat']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Cleo', breed: 'Bengal', age: 7, photoUrl: 'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?w=400' },
      ]),
    },
    // 10 — Shinjuku, Tokyo (owner 6 = Yuki)
    {
      ownerId:      6,
      title:        'Tokyo Shinjuku Townhouse',
      description:  'A serene Japanese townhouse tucked into a quiet lane in Shinjuku, minutes from the buzzing city yet utterly peaceful inside. Tatami floors, a small zen garden, and all modern comforts. Soba is a three-year-old Shiba Inu — calm, independent, and perfectly behaved on a lead.',
      address:      '2-14 Shinjuku, Tokyo',
      latitude:     35.6938,
      longitude:    139.7034,
      city:         'Tokyo',
      country:      'Japan',
      bedrooms:     2,
      bathrooms:    1,
      amenities:    JSON.stringify(['wifi', 'garden', 'workspace', 'washer', 'central location']),
      petCount:     1,
      petTypes:     JSON.stringify(['dog']),
      coverPhotoUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
      photos:       JSON.stringify([
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        'https://images.unsplash.com/photo-1521783988139-89397d761dce?w=800',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
      ]),
      petPhotos:    JSON.stringify([
        { name: 'Soba', breed: 'Shiba Inu', age: 3, photoUrl: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400' },
      ]),
    },
  ];

  await db.insert(listings).values(mockListings);

  // ── Sits — all open, future dates in 2026 ────────────────────────────────────
  // Format: { listingId, ownerId, startDate, endDate }
  const mockSits = [
    // Listing 1 — Kensington Flat (owner 1)
    { listingId: 1, ownerId: 1, startDate: '2026-05-03', endDate: '2026-05-17' },
    { listingId: 1, ownerId: 1, startDate: '2026-07-12', endDate: '2026-07-26' },
    { listingId: 1, ownerId: 1, startDate: '2026-10-01', endDate: '2026-10-21' },

    // Listing 2 — Provençal Farmhouse (owner 3)
    { listingId: 2, ownerId: 3, startDate: '2026-06-15', endDate: '2026-06-29' },
    { listingId: 2, ownerId: 3, startDate: '2026-08-01', endDate: '2026-08-22' },
    { listingId: 2, ownerId: 3, startDate: '2026-09-05', endDate: '2026-09-14' },

    // Listing 3 — Tribeca Loft (owner 5)
    { listingId: 3, ownerId: 5, startDate: '2026-05-22', endDate: '2026-06-04' },
    { listingId: 3, ownerId: 5, startDate: '2026-08-14', endDate: '2026-08-28' },

    // Listing 4 — Bondi Beach House (owner 5)
    { listingId: 4, ownerId: 5, startDate: '2026-06-20', endDate: '2026-07-04' },
    { listingId: 4, ownerId: 5, startDate: '2026-11-01', endDate: '2026-11-21' },
    { listingId: 4, ownerId: 5, startDate: '2026-12-20', endDate: '2027-01-08' },

    // Listing 5 — Kyoto Machiya (owner 4)
    { listingId: 5, ownerId: 4, startDate: '2026-04-25', endDate: '2026-05-09' },
    { listingId: 5, ownerId: 4, startDate: '2026-10-10', endDate: '2026-10-24' },

    // Listing 6 — Santorini Villa (owner 4)
    { listingId: 6, ownerId: 4, startDate: '2026-06-28', endDate: '2026-07-12' },
    { listingId: 6, ownerId: 4, startDate: '2026-09-14', endDate: '2026-09-28' },

    // Listing 7 — Brooklyn Brownstone (owner 5)
    { listingId: 7, ownerId: 5, startDate: '2026-05-10', endDate: '2026-05-24' },
    { listingId: 7, ownerId: 5, startDate: '2026-07-18', endDate: '2026-08-01' },
    { listingId: 7, ownerId: 5, startDate: '2026-11-07', endDate: '2026-11-21' },

    // Listing 8 — Edinburgh Apartment (owner 1)
    { listingId: 8, ownerId: 1, startDate: '2026-08-03', endDate: '2026-08-17' },
    { listingId: 8, ownerId: 1, startDate: '2026-12-22', endDate: '2027-01-05' },

    // Listing 9 — Barcelona Penthouse (owner 4)
    { listingId: 9, ownerId: 4, startDate: '2026-05-29', endDate: '2026-06-12' },
    { listingId: 9, ownerId: 4, startDate: '2026-08-07', endDate: '2026-08-21' },

    // Listing 10 — Tokyo Shinjuku Townhouse (owner 6)
    { listingId: 10, ownerId: 6, startDate: '2026-06-07', endDate: '2026-06-21' },
    { listingId: 10, ownerId: 6, startDate: '2026-10-03', endDate: '2026-10-17' },
  ];

  for (const sit of mockSits) {
    await db.insert(sits).values({ ...sit, status: 'open' });
  }

  // ── Reviews for owners ───────────────────────────────────────────────────────
  const mockReviews = [
    // Owner 1 — Sophie Clarke (23 reviews, rating 4.9)
    { subjectId: 1, authorName: 'Emma T.',    authorAvatarUrl: 'https://i.pravatar.cc/80?img=1',  sitDescription: 'Kensington · May 2025',     rating: 5, body: "Sophie's flat in Kensington was an absolute dream. Bella is the most loving dog I've ever met — she made the whole experience so special. The flat was spotless and Sophie kept in touch throughout. Would sit again in a heartbeat." },
    { subjectId: 1, authorName: 'Alistair M.', authorAvatarUrl: 'https://i.pravatar.cc/80?img=3', sitDescription: 'Edinburgh · August 2025',     rating: 5, body: "Everything was exactly as described. Hamish is wonderful and very easy to look after. Sophie left clear instructions and both properties are gorgeous. Highly recommend." },
    { subjectId: 1, authorName: 'Priya S.',   authorAvatarUrl: 'https://i.pravatar.cc/80?img=9',  sitDescription: 'Kensington · October 2024',   rating: 5, body: "Such a lovely home in a brilliant location. Bella had us all wrapped around her paw by day two. Sophie is very responsive and clearly cares deeply about her dog's wellbeing." },
    { subjectId: 1, authorName: 'Tom B.',     authorAvatarUrl: 'https://i.pravatar.cc/80?img=11', sitDescription: 'Montreal · June 2025',         rating: 5, body: "The Victorian home in Montreal is stunning and Charlie & Brie are the sweetest pair. Sophie's notes were thorough and the rooftop was a bonus I didn't expect. Brilliant sit." },
    { subjectId: 1, authorName: 'Léa F.',     authorAvatarUrl: 'https://i.pravatar.cc/80?img=5',  sitDescription: 'Edinburgh · December 2024',   rating: 4, body: "A great experience overall. Hamish is brilliant and the New Town apartment is beautiful. Minor teething issues with the heating but Sophie sorted it immediately. Would definitely return." },

    // Owner 3 — Jean-Pierre Moreau (17 reviews, rating 4.8)
    { subjectId: 3, authorName: 'Hannah B.',  authorAvatarUrl: 'https://i.pravatar.cc/80?img=16', sitDescription: 'Provence · July 2025',         rating: 5, body: "Staying at Jean-Pierre's farmhouse was genuinely life-changing. Luna and Mochi are gentle, independent cats who were perfect company. The pool, the lavender, the kitchen — everything exceeded expectations." },
    { subjectId: 3, authorName: 'Sam K.',     authorAvatarUrl: 'https://i.pravatar.cc/80?img=17', sitDescription: 'Tuscany · August 2025',        rating: 5, body: "The Val d'Orcia villa is even more spectacular in person. Dante and Lucia are majestic dogs — well-trained and deeply lovable. Jean-Pierre is thoughtful and thorough with his handover." },
    { subjectId: 3, authorName: 'Olivia H.',  authorAvatarUrl: 'https://i.pravatar.cc/80?img=19', sitDescription: 'Provence · September 2024',    rating: 5, body: "Absolutely perfect in every way. The Luberon landscape is extraordinary and the farmhouse is even better in person. Luna and Mochi couldn't be easier. This is the kind of sit that makes you rethink your whole life." },
    { subjectId: 3, authorName: 'Daniel W.',  authorAvatarUrl: 'https://i.pravatar.cc/80?img=20', sitDescription: 'Lisbon · May 2025',            rating: 4, body: "Very nice house and lovely dog. Jean-Pierre communicates well and gave clear instructions. Porto is a joy to walk in the Alfama. The Wi-Fi was a bit slow but otherwise a great stay." },

    // Owner 4 — Elena Rodriguez (31 reviews, rating 4.95)
    { subjectId: 4, authorName: 'Marcos L.',  authorAvatarUrl: 'https://i.pravatar.cc/80?img=25', sitDescription: 'Barcelona · June 2025',        rating: 5, body: "Elena's penthouse is incredible — the rooftop terrace alone is worth the sit. Cleo is a total character, very chatty and endlessly entertaining. Brilliant experience from start to finish." },
    { subjectId: 4, authorName: 'Yuki N.',    authorAvatarUrl: 'https://i.pravatar.cc/80?img=26', sitDescription: 'Kyoto · October 2024',         rating: 5, body: "The machiya townhouse is extraordinary — calm, beautiful and full of character. Hana is so gentle and undemanding. Elena leaves immaculate notes and is always available if you have questions." },
    { subjectId: 4, authorName: 'Clara D.',   authorAvatarUrl: 'https://i.pravatar.cc/80?img=28', sitDescription: 'Santorini · July 2025',        rating: 5, body: "I genuinely did not want to leave. The clifftop villa is as stunning as the photos. Nikos is a laid-back, self-sufficient cat who's great company on warm evenings. Elena is an exceptional host." },
    { subjectId: 4, authorName: 'Ahmed R.',   authorAvatarUrl: 'https://i.pravatar.cc/80?img=30', sitDescription: 'Bali · May 2025',              rating: 5, body: "The Bali villa is unlike anything else on this platform. Sari and Bali are beautiful, serene cats perfectly suited to the setting. Elena's communication and instructions are first-rate." },
    { subjectId: 4, authorName: 'Freya J.',   authorAvatarUrl: 'https://i.pravatar.cc/80?img=31', sitDescription: 'Barcelona · August 2024',      rating: 5, body: "Cleo charmed us within hours. The pool, the terrace, the Eixample location — Elena's home has everything. She's warm, organized, and made us feel completely trusted. Outstanding sit." },

    // Owner 5 — Marcus Williams (14 reviews, rating 4.7)
    { subjectId: 5, authorName: 'Jasmine W.', authorAvatarUrl: 'https://i.pravatar.cc/80?img=35', sitDescription: 'Tribeca · May 2025',    rating: 5, body: "Marcus's Tribeca loft is spectacular and Max is a great little dog — very manageable, loves his walks, and full of personality. The apartment has everything you need. Would absolutely sit again." },
    { subjectId: 5, authorName: 'Tom R.',     authorAvatarUrl: 'https://i.pravatar.cc/80?img=36', sitDescription: 'Bondi · November 2024', rating: 4, body: "Archie and Milo are a handful — two Labradors with boundless energy — but the beach access makes the walks a joy. The Bondi house is stunning. Marcus is approachable and the instructions were spot-on." },
    { subjectId: 5, authorName: 'Nina P.',    authorAvatarUrl: 'https://i.pravatar.cc/80?img=37', sitDescription: 'Brooklyn · July 2025',  rating: 5, body: "The brownstone is gorgeous and the garden was a delight in summer. Biscuit and Pepper are the most charming duo. Marcus keeps the place beautifully maintained and is easy to communicate with." },
  ];

  for (const review of mockReviews) {
    await db.insert(reviews).values(review);
  }
}
