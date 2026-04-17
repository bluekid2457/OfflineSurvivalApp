export const survivalCategories = {
  shelter: {
    keywords: ['shelter', 'tent', 'cave', 'lean-to', 'hut', 'roof', 'insulation', 'warmth', 'protection'],
    label: 'Shelter',
    color: '#7c3aed',
  },
  water: {
    keywords: ['water', 'hydration', 'drink', 'purify', 'filter', 'collect', 'dehydration', 'thirst'],
    label: 'Water',
    color: '#06b6d4',
  },
  fire: {
    keywords: ['fire', 'heat', 'flame', 'burn', 'warmth', 'cooking', 'smoke', 'light', 'kindle', 'tinder'],
    label: 'Fire',
    color: '#f97316',
  },
  firstAid: {
    keywords: ['first aid', 'wound', 'bleed', 'injury', 'pain', 'illness', 'medical', 'infection', 'treatment', 'poisoning', 'fracture'],
    label: 'First Aid',
    color: '#ec4899',
  },
  food: {
    keywords: ['food', 'edible', 'plants', 'hunt', 'fish', 'nutrition', 'eat', 'berries', 'insects', 'protein'],
    label: 'Food',
    color: '#22c55e',
  },
  navigation: {
    keywords: ['navigation', 'direction', 'compass', 'map', 'north', 'location', 'orient', 'path', 'route', 'position'],
    label: 'Navigation',
    color: '#8b5cf6',
  },
  signaling: {
    keywords: ['signal', 'rescue', 'help', 'distress', 'sos', 'mirror', 'whistle', 'visibility', 'attract'],
    label: 'Signaling',
    color: '#fbbf24',
  },
};

export function categorizeContent(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  for (const [key, category] of Object.entries(survivalCategories)) {
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword)) {
        return { key, ...category };
      }
    }
  }

  return null;
}
