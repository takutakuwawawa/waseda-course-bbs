export type Faculty = {
  slug: string
  label: string
  courseCount: number
}

export type Course = {
  id: string
  code: string
  name: string
  teacher: string | null
  faculty: string
  facultySlug: string
  term: string | null
  schedule: string | null
  credits: number | null
  methodType: string | null
  year: number | null
}
