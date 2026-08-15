/* Rising Star — static game data (all original names & branding) */
(function (RS) {
  'use strict';

  var LEAGUES = [
    { name: 'Vanguard League', short: 'VGL', tier: 1, prize: 4200, wageBase: 9500 },
    { name: 'Ascendant League', short: 'ASL', tier: 2, prize: 1600, wageBase: 3600 },
    { name: 'Frontier League', short: 'FRL', tier: 3, prize: 620, wageBase: 1300 },
    { name: 'Foundation League', short: 'FDL', tier: 4, prize: 220, wageBase: 420 }
  ];

  // 48 original clubs, 12 per tier. str = base strength 1-100.
  var CLUBS = [
    // Tier 1
    ['Ardent City', 'ARD', 1, 88, '#e8452b', '#1c1c22'],
    ['Northgate United', 'NGU', 1, 86, '#d81f45', '#f6f2e8'],
    ['Royal Vermillion', 'RVM', 1, 84, '#8f1d3f', '#f2c14e'],
    ['Sable Athletic', 'SAB', 1, 82, '#2b2f38', '#7dd3fc'],
    ['Cobalt Rovers', 'COB', 1, 80, '#2563eb', '#f8fafc'],
    ['Kingsford FC', 'KGF', 1, 78, '#f2c14e', '#1f2430'],
    ['Highmoor United', 'HMU', 1, 76, '#7c3aed', '#eae6ff'],
    ['Marrow Town', 'MRW', 1, 74, '#0f766e', '#f0fdfa'],
    ['Verdant Park', 'VPK', 1, 73, '#16a34a', '#0b1d12'],
    ['Ironvale FC', 'IRN', 1, 71, '#64748b', '#0f172a'],
    ['Solstice AFC', 'SOL', 1, 70, '#f97316', '#3b1d05'],
    ['Grandhaven City', 'GHV', 1, 69, '#0ea5e9', '#052236'],
    // Tier 2
    ['Bellcastle FC', 'BEL', 2, 66, '#b91c1c', '#fde68a'],
    ['Portmere United', 'PRT', 2, 65, '#1d4ed8', '#fbbf24'],
    ['Duskbury Town', 'DSK', 2, 64, '#4c1d95', '#c4b5fd'],
    ['Whitecliff Rovers', 'WHC', 2, 63, '#e2e8f0', '#0f172a'],
    ['Larkfield AFC', 'LRK', 2, 62, '#65a30d', '#1a2e05'],
    ['Foxholt City', 'FXH', 2, 61, '#ea580c', '#fff7ed'],
    ['Redstone United', 'RDS', 2, 60, '#dc2626', '#111827'],
    ['Ashgrove FC', 'ASH', 2, 59, '#334155', '#94a3b8'],
    ['Silverbrook', 'SLV', 2, 58, '#94a3b8', '#1e293b'],
    ['Kestrel Bay', 'KST', 2, 57, '#0891b2', '#ecfeff'],
    ['Thornwick Town', 'THW', 2, 56, '#166534', '#fef08a'],
    ['Meridian FC', 'MRD', 2, 55, '#7e22ce', '#fdf4ff'],
    // Tier 3
    ['Oakhurst Town', 'OAK', 3, 50, '#a16207', '#fef3c7'],
    ['Brackenford', 'BRK', 3, 49, '#15803d', '#dcfce7'],
    ['Copperfield United', 'CPF', 3, 48, '#c2410c', '#1c1917'],
    ['Nettleford AFC', 'NTF', 3, 47, '#4d7c0f', '#f7fee7'],
    ['Saltmarsh City', 'SLT', 3, 46, '#0369a1', '#e0f2fe'],
    ['Ravensden FC', 'RVN', 3, 45, '#1e1b4b', '#a5b4fc'],
    ['Fernwick Town', 'FNW', 3, 44, '#047857', '#d1fae5'],
    ['Glasshill United', 'GLS', 3, 43, '#0f766e', '#fef9c3'],
    ['Tidebrook AFC', 'TDB', 3, 42, '#0284c7', '#f0f9ff'],
    ['Harrowgate', 'HRG', 3, 41, '#831843', '#fbcfe8'],
    ['Pinevale FC', 'PNV', 3, 40, '#166534', '#bbf7d0'],
    ['Emberton Town', 'EMB', 3, 39, '#b45309', '#fff7ed'],
    // Tier 4
    ['Millbrook Athletic', 'MLB', 4, 34, '#1d4ed8', '#fef08a'],
    ['Stonebridge Town', 'STB', 4, 33, '#475569', '#e2e8f0'],
    ['Hollowfield FC', 'HLF', 4, 32, '#7f1d1d', '#fecaca'],
    ['Westhaven Rangers', 'WHR', 4, 31, '#0f766e', '#ccfbf1'],
    ['Cinderhill AFC', 'CDH', 4, 30, '#9a3412', '#ffedd5'],
    ['Marshend United', 'MSE', 4, 29, '#3f6212', '#ecfccb'],
    ['Bramblewood FC', 'BRW', 4, 28, '#5b21b6', '#ede9fe'],
    ['Dunmore Town', 'DNM', 4, 27, '#0c4a6e', '#bae6fd'],
    ['Quarryside AFC', 'QRY', 4, 26, '#78350f', '#fde68a'],
    ['Fallowmead FC', 'FLW', 4, 25, '#065f46', '#a7f3d0'],
    ['Netherby Rangers', 'NTB', 4, 24, '#881337', '#fecdd3'],
    ['Colwick United', 'CLW', 4, 23, '#1e293b', '#38bdf8']
  ].map(function (c, i) {
    return {
      id: i,
      name: c[0],
      short: c[1],
      tier: c[2],
      str: c[3],
      c1: c[4],
      c2: c[5]
    };
  });

  var NATIONS = [
    'England', 'Brazil', 'Spain', 'France', 'Argentina', 'Nigeria', 'Japan', 'Norway',
    'Portugal', 'Croatia', 'Ghana', 'Mexico', 'Netherlands', 'Israel', 'Senegal',
    'South Korea', 'Italy', 'Germany', 'Colombia', 'Morocco', 'Australia', 'Canada'
  ];

  var FIRST_NAMES = ['Alex', 'Milo', 'Rafa', 'Tayo', 'Kai', 'Nico', 'Jonah', 'Andre', 'Luca', 'Emre',
    'Diego', 'Femi', 'Ivan', 'Omar', 'Theo', 'Kenji', 'Marco', 'Dylan', 'Sasha', 'Yuri',
    'Noah', 'Elias', 'Rui', 'Bruno', 'Kofi', 'Adam', 'Leo', 'Mateo', 'Idris', 'Jae',
    'Roan', 'Zane', 'Hugo', 'Sami', 'Toni', 'Rico', 'Ben', 'Malik', 'Ravi', 'Otto'];

  var LAST_NAMES = ['Mercer', 'Vance', 'Okoro', 'Halberg', 'Duarte', 'Fenwick', 'Rios', 'Lindqvist',
    'Abara', 'Castellan', 'Novak', 'Ferreira', 'Bright', 'Marchetti', 'Osei', 'Tanaka',
    'Delacroix', 'Whitlock', 'Krause', 'Sandoval', 'Baptiste', 'Ashford', 'Moreau', 'Kovac',
    'Adeyemi', 'Lund', 'Serrano', 'Petrov', 'Blackwood', 'Nakamura', 'Elian', 'Ravensworth',
    'Costa', 'Ibarra', 'Sorenson', 'Achebe', 'Vetrov', 'Marlowe', 'Quintero', 'Bergstrom',
    'Farrow', 'Danilo', 'Kessler', 'Amadi', 'Rhodes', 'Verano', 'Solberg', 'Nkemdi'];

  // Player positions the user can pick
  var POSITIONS = [
    { key: 'ST', name: 'Striker', desc: 'Live in the box. Chances, headers and one-on-ones.',
      bias: { shooting: 8, pace: 4, technique: 2, passing: -4, defending: -8 } },
    { key: 'W', name: 'Winger', desc: 'Beat your marker, whip crosses, cut inside and shoot.',
      bias: { pace: 8, dribbling: 7, technique: 3, strength: -5, defending: -6 } },
    { key: 'AM', name: 'Playmaker', desc: 'Run the game. Through balls, set pieces, late runs.',
      bias: { passing: 8, technique: 6, setPieces: 4, strength: -4, defending: -4 } },
    { key: 'CM', name: 'Box-to-box', desc: 'Everywhere. Tackles, drives, long shots, stamina.',
      bias: { stamina: 7, strength: 5, defending: 5, passing: 2, shooting: -3 } }
  ];

  var ATTRS = [
    { key: 'shooting', name: 'Shooting', short: 'SHO', desc: 'Power and accuracy when you strike it.' },
    { key: 'passing', name: 'Passing', short: 'PAS', desc: 'Weight and precision of your passes.' },
    { key: 'dribbling', name: 'Dribbling', short: 'DRI', desc: 'Beating defenders in tight spaces.' },
    { key: 'technique', name: 'Technique', short: 'TEC', desc: 'First touch and how much you can bend it.' },
    { key: 'pace', name: 'Pace', short: 'PAC', desc: 'Getting there first. More chances per match.' },
    { key: 'strength', name: 'Strength', short: 'STR', desc: 'Winning duels, headers and hold-up play.' },
    { key: 'stamina', name: 'Stamina', short: 'STA', desc: 'Energy you burn in 90 minutes.' },
    { key: 'defending', name: 'Defending', short: 'DEF', desc: 'Tackles, blocks and pressing.' },
    { key: 'setPieces', name: 'Set Pieces', short: 'SET', desc: 'Free kicks and penalties.' },
    { key: 'composure', name: 'Composure', short: 'CMP', desc: 'Calm under pressure. Bigger timing windows.' }
  ];

  var TRAITS = [
    { key: 'finisher', name: 'Natural Finisher', desc: '+ Shooting, + Composure. Cool in front of goal.',
      bias: { shooting: 7, composure: 5 } },
    { key: 'magician', name: 'Street Magician', desc: '+ Dribbling, + Technique. You bend it and beat people.',
      bias: { dribbling: 7, technique: 5 } },
    { key: 'engine', name: 'Engine', desc: '+ Stamina, + Pace. You never stop running.',
      bias: { stamina: 7, pace: 5 } },
    { key: 'deadball', name: 'Dead-ball Specialist', desc: '+ Set Pieces, + Passing. Free kicks are yours.',
      bias: { setPieces: 8, passing: 4 } }
  ];

  // Lifestyle / shop items
  var ITEMS = [
    { key: 'boots', name: 'Signature Boots', cost: 900, icon: '👟',
      desc: 'Lighter, grippier. +2 Shooting, +2 Dribbling, permanently.',
      effect: { attr: { shooting: 2, dribbling: 2 } }, once: true },
    { key: 'nutritionist', name: 'Nutritionist', cost: 1600, icon: '🥗',
      desc: 'Recover faster forever. +6 energy every week.',
      effect: { perk: 'nutritionist' }, once: true },
    { key: 'coach', name: 'Private Coach', cost: 3200, icon: '🎯',
      desc: 'Training gives 35% more progress, for the rest of your career.',
      effect: { perk: 'coach' }, once: true },
    { key: 'agent', name: 'Sharp Agent', cost: 5000, icon: '🕴️',
      desc: 'Better contracts and more transfer interest.',
      effect: { perk: 'agent' }, once: true },
    { key: 'car', name: 'Nice Car', cost: 12000, icon: '🚗',
      desc: 'Turning up in style. +12 Fans, +8 Partner.',
      effect: { rel: { fans: 12, partner: 8 } }, once: true },
    { key: 'house', name: 'Own Place', cost: 40000, icon: '🏡',
      desc: 'Peace and quiet. +10 energy every week, +10 Partner.',
      effect: { perk: 'house', rel: { partner: 10 } }, once: true }
  ];

  // Repeatable weekly activities (cost a slot)
  var ACTIVITIES = [
    { key: 'rest', name: 'Rest Up', icon: '😴', cost: 0, desc: 'Sleep, ice bath, do nothing. Big energy boost.' },
    { key: 'teammates', name: 'Team Bonding', icon: '🎮', cost: 120, desc: 'Games night with the lads. Teammates like you more.' },
    { key: 'boss', name: 'See The Boss', icon: '📋', cost: 0, desc: 'Extra video session with the manager.' },
    { key: 'fans', name: 'Fan Event', icon: '📸', cost: 0, desc: 'Signing session at the club shop.' },
    { key: 'partner', name: 'Family Time', icon: '💛', cost: 80, desc: 'Actually show up for the people who matter.' },
    { key: 'sponsor', name: 'Sponsor Shoot', icon: '💼', cost: 0, desc: 'Photo shoot. Pays well if your name is hot.' },
    { key: 'charity', name: 'Community Day', icon: '🤝', cost: 200, desc: 'Local kids clinic. Fans and press love it.' },
    { key: 'gym', name: 'Extra Gym', icon: '🏋️', cost: 60, desc: 'Grind session. Strength and stamina progress.' }
  ];

  var COMMENTARY = {
    kickoff: ['We are underway.', 'The whistle goes.', 'Game on.'],
    home: ['{t} pushing forward.', '{t} keeping the ball.', '{t} building slowly.'],
    goalFor: ['{p} finds the net for {t}!', 'It\'s in! {t} lead the charge.', '{t} score!'],
    goalAgainst: ['{t} punish the defence.', 'Disaster at the back — {t} score.', '{t} make it count.'],
    half: ['Half time.', 'The whistle for the break.']
  };

  RS.Data = {
    LEAGUES: LEAGUES,
    CLUBS: CLUBS,
    NATIONS: NATIONS,
    FIRST_NAMES: FIRST_NAMES,
    LAST_NAMES: LAST_NAMES,
    POSITIONS: POSITIONS,
    ATTRS: ATTRS,
    TRAITS: TRAITS,
    ITEMS: ITEMS,
    ACTIVITIES: ACTIVITIES,
    COMMENTARY: COMMENTARY,
    club: function (id) { return CLUBS[id]; },
    clubsInTier: function (t) {
      return CLUBS.filter(function (c) { return c.tier === t; });
    }
  };
})(window.RS = window.RS || {});
