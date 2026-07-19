import { ArrowLeft, ExternalLink, MessageSquareText, NotebookTabs } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BbsBoard } from '../components/BbsBoard'
import { ExamBoard } from '../components/ExamBoard'
import { StatusNotice } from '../components/StatusNotice'
import { getCourses } from '../lib/catalog'
import type { Course } from '../types/catalog'

type DetailTab = 'bbs' | 'exam'

export function CoursePage() {
  const { facultySlug = '', courseId = '' } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('bbs')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCourses(facultySlug)
      .then((courses) => {
        const found = courses.find((item) => item.id === courseId)
        if (!found) throw new Error('科目が見つかりませんでした')
        setCourse(found)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '科目を読み込めませんでした')
      })
  }, [courseId, facultySlug])

  if (error) {
    return <div className="content-column"><StatusNotice>{error}</StatusNotice></div>
  }
  if (!course) {
    return <div className="content-column"><div className="empty-state">読み込み中...</div></div>
  }

  return (
    <div className="content-column detail-page">
      <Link className="back-link" to={`/faculty/${facultySlug}`}><ArrowLeft size={16} /> {course.faculty}</Link>

      <header className="course-header">
        <div className="course-header-topline">
          <span>{course.year ? `${course.year}年度` : '開講年度未登録'}</span>
          <span>{course.code || '科目コード未登録'}</span>
        </div>
        <h1>{course.name}</h1>
        <p className="course-teacher">{course.teacher ?? '教員未定'}</p>
        <div className="course-detail-meta">
          {course.term && <span>{course.term}</span>}
          {course.schedule && <span>{course.schedule}</span>}
          {course.credits != null && <span>{course.credits}単位</span>}
          {course.methodType && <span>{course.methodType.replace(/[【】]/g, '')}</span>}
        </div>
        <a
          className="official-link"
          href="https://www.wsl.waseda.jp/syllabus/JAA101.php?pLng=jp"
          target="_blank"
          rel="noreferrer"
        >
          公式シラバスで確認 <ExternalLink size={15} />
        </a>
      </header>

      <div className="detail-tabs" role="tablist" aria-label="科目掲示板">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bbs'}
          className={activeTab === 'bbs' ? 'active' : ''}
          onClick={() => setActiveTab('bbs')}
        >
          <MessageSquareText size={18} /> BBS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'exam'}
          className={activeTab === 'exam' ? 'active' : ''}
          onClick={() => setActiveTab('exam')}
        >
          <NotebookTabs size={18} /> テスト情報
        </button>
      </div>

      {activeTab === 'bbs' ? <BbsBoard courseId={course.id} /> : <ExamBoard courseId={course.id} />}
    </div>
  )
}
