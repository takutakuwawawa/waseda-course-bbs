import type { Course, Faculty } from '../types/catalog'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(dataUrl(path))
  if (!response.ok) {
    throw new Error('科目データを読み込めませんでした')
  }
  return response.json() as Promise<T>
}

export function getFaculties() {
  return readJson<Faculty[]>('faculties.json')
}

export function getCourses(facultySlug: string) {
  return readJson<Course[]>(`courses/${facultySlug}.json`)
}
