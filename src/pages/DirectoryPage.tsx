import { ArrowRight, BookOpenText, Building2, MessageSquareText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFaculties } from '../lib/catalog'
import type { Faculty } from '../types/catalog'
import { StatusNotice } from '../components/StatusNotice'

export function DirectoryPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFaculties().then(setFaculties).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : '学部一覧を読み込めませんでした')
    })
  }, [])

  return (
    <div className="content-column directory-page">
      <section className="page-intro compact-intro">
        <div>
          <span className="eyebrow">COURSE DIRECTORY</span>
          <h1>科目を探す</h1>
          <p>学部を選び、授業ごとの掲示板やテスト情報を確認できます。</p>
        </div>
        <div className="intro-stat" aria-label="収録科目数">
          <strong>{faculties.reduce((sum, faculty) => sum + faculty.courseCount, 0).toLocaleString()}</strong>
          <span>科目</span>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <Building2 size={18} />
          <h2>学部・センター</h2>
        </div>
        <span>{faculties.length}区分</span>
      </div>

      {error && <StatusNotice>{error}</StatusNotice>}

      <div className="faculty-grid">
        {faculties.map((faculty) => (
          <Link className="faculty-item" to={`/faculty/${faculty.slug}`} key={faculty.slug}>
            <div className="faculty-icon" aria-hidden="true">
              <BookOpenText size={21} />
            </div>
            <div>
              <strong>{faculty.label}</strong>
              <span>{faculty.courseCount.toLocaleString()}科目</span>
            </div>
            <ArrowRight size={18} />
          </Link>
        ))}
      </div>

      <section className="community-note">
        <MessageSquareText size={21} />
        <div>
          <strong>授業内容ではなく、学生の情報交換が中心です</strong>
          <p>公式シラバスの転載は行わず、科目を探すために必要な基本情報だけを掲載します。</p>
        </div>
      </section>
    </div>
  )
}
