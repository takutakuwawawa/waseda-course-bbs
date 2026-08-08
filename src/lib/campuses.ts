export type Campus = {
  slug: string
  label: string
  facultySlugs: string[]
}

export const CAMPUSES: Campus[] = [
  {
    slug: 'waseda',
    label: '早稲田キャンパス',
    facultySlugs: ['law', 'education', 'commerce', 'social_sciences', 'global_education'],
  },
  {
    slug: 'toyama',
    label: '戸山キャンパス',
    facultySlugs: ['culture_community', 'letters'],
  },
  {
    slug: 'tokorozawa',
    label: '所沢キャンパス',
    facultySlugs: ['sport_sciences'],
  },
]

export function getCampus(campusSlug: string) {
  return CAMPUSES.find((campus) => campus.slug === campusSlug) ?? null
}

export function getCampusForFaculty(facultySlug: string) {
  return CAMPUSES.find((campus) => campus.facultySlugs.includes(facultySlug)) ?? null
}
