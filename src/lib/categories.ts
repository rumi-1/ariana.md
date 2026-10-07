// The subject areas of the wiki. Every article belongs to exactly one.
// Order here is the order shown in navigation and on the home page.
export const CATEGORIES = [
  {
    id: 'geography',
    name: 'Geography',
    blurb: 'Mountains, rivers, deserts, and the routes that cross them.',
  },
  {
    id: 'history',
    name: 'History',
    blurb: 'From the first settlements to the modern states of the region.',
  },
  {
    id: 'peoples',
    name: 'Peoples',
    blurb: 'Ethnic groups, tribes, and communities, described on their own terms.',
  },
  {
    id: 'languages',
    name: 'Languages',
    blurb: 'Iranian, Turkic, and other languages, their scripts, and their speakers.',
  },
  {
    id: 'genetics',
    name: 'Genetics',
    blurb: 'What population genetics and ancient DNA can and cannot tell us.',
  },
  {
    id: 'culture',
    name: 'Culture',
    blurb: 'Religion, literature, music, food, and everyday life.',
  },
  {
    id: 'figures',
    name: 'Notable Figures',
    blurb: 'Rulers, poets, scholars, and others who shaped the region.',
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

// z.enum needs a non-empty tuple of literal strings.
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [
  CategoryId,
  ...CategoryId[],
];

export function getCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}
