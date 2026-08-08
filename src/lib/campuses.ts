export type Campus = {
  slug: string
  label: string
  facultySlugs: string[]
}

export const CAMPUSES: Campus[] = [
  {
    slug: 'waseda',
    label: '早稲田キャンパス',
    facultySlugs: [
      'politics_economics',
      'law',
      'education',
      'commerce',
      'social_sciences',
      'international',
      'global_education',
    ],
  },
  {
    slug: 'toyama',
    label: '戸山キャンパス',
    facultySlugs: ['culture_community', 'letters'],
  },
  {
    slug: 'tokorozawa',
    label: '所沢キャンパス',
    facultySlugs: ['human_sciences', 'sport_sciences', 'human_correspondence'],
  },
  {
    slug: 'nishiwaseda',
    label: '西早稲田キャンパス',
    facultySlugs: ['fundamental_sci', 'creative_sci', 'advanced_sci'],
  },
]

export function getCampus(campusSlug: string) {
  return CAMPUSES.find((campus) => campus.slug === campusSlug) ?? null
}

export function getCampusForFaculty(facultySlug: string) {
  return CAMPUSES.find((campus) => campus.facultySlugs.includes(facultySlug)) ?? null
}
