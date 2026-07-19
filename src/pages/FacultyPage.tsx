import { ArrowLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCourses, getFaculties } from '../lib/catalog'
import type { Course, Faculty } from '../types/catalog'
import { StatusNotice } from '../components/StatusNotice'

const PAGE_SIZE = 50

export function FacultyPage() {
  const { facultySlug = '' } = useParams()
  const [faculty, setFaculty] = useState<Faculty | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([getFaculties(), getCourses(facultySlug)])
      .then(([facultyList, courseList]) => {
        setFaculty(facultyList.find((item) => item.slug === facultySlug) ?? null)
        setCourses(courseList)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '科目一覧を読み込めませんでした')
      })
      .finally(() => setLoading(false))
  }, [facultySlug])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, term])

  const terms = useMemo(
    () => [...new Set(courses.map((course) => course.term).filter((value): value is string => Boolean(value)))].sort(),
    [courses],
  )

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP')
    return courses.filter((course) => {
      if (term && course.term !== term) return false
      if (!normalizedQuery) return true
      return [course.name, course.teacher, course.code]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('ja-JP').includes(normalizedQuery))
    })
  }, [courses, query, term])

  return (
    <div className="content-column">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> 学部一覧</Link>
      <section className="page-intro faculty-intro">
        <div>
          <span className="eyebrow">FACULTY</span>
          <h1>{faculty?.label ?? '科目一覧'}</h1>
          <p>科目名・教員名・科目コードから探せます。</p>
        </div>
        {faculty && <div className="intro-stat"><strong>{faculty.courseCount.toLocaleString()}</strong><span>科目</span></div>}
      </section>

      <div className="course-filter-bar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="科目名・教員名・科目コード"
            aria-label="科目を検索"
          />
        </label>
        <label className="select-field">
          <SlidersHorizontal size={17} />
          <select value={term} onChange={(event) => setTerm(event.target.value)} aria-label="学期で絞り込む">
            <option value="">すべての学期</option>
            {terms.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {error && <StatusNotice>{error}</StatusNotice>}

      <div className="list-summary">
        <strong>{filteredCourses.length.toLocaleString()}件</strong>
        {(query || term) && <button type="button" onClick={() => { setQuery(''); setTerm('') }}>条件をクリア</button>}
      </div>

      {loading ? (
        <div className="empty-state">科目を読み込んでいます...</div>
      ) : filteredCourses.length === 0 ? (
        <div className="empty-state">条件に一致する科目がありません。</div>
      ) : (
        <div className="course-list">
          {filteredCourses.slice(0, visibleCount).map((course) => (
            <Link className="course-row" to={`/faculty/${facultySlug}/course/${course.id}`} key={course.id}>
              <div className="course-main">
                <h2>{course.name}</h2>
                <p>{course.teacher ?? '教員未定'}</p>
                <div className="course-meta">
                  {course.term && <span>{course.term}</span>}
                  {course.schedule && <span>{course.schedule}</span>}
                  {course.credits != null && <span>{course.credits}単位</span>}
                  {course.methodType && <span>{course.methodType.replace(/[【】]/g, '')}</span>}
                </div>
              </div>
              <div className="course-code">{course.code || 'コード未登録'}</div>
              <ChevronRight size={19} />
            </Link>
          ))}
        </div>
      )}

      {visibleCount < filteredCourses.length && (
        <button type="button" className="load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
          さらに表示
        </button>
      )}
    </div>
  )
}
