import { MessageSquareText } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Minerva Community ホーム">
            <span className="brand-crop" aria-hidden="true">
              <img src={`${import.meta.env.BASE_URL}minerva-logo.png`} alt="" />
            </span>
          </Link>
          <div className="product-name">
            <MessageSquareText size={16} strokeWidth={1.8} />
            <span>COURSE COMMUNITY</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="page-shell">{children}</main>
      <footer className="site-footer">
        <div>
          <strong>Minerva Community</strong>
          <p>
            早稲田大学の学生が個人的に制作する非公式サイトです。早稲田大学とは関係ありません。
            掲載情報は参考として扱い、履修時は必ず公式シラバスをご確認ください。
          </p>
        </div>
        <a href="https://www.wsl.waseda.jp/syllabus/JAA101.php?pLng=jp" target="_blank" rel="noreferrer">
          早稲田大学 公式シラバス
        </a>
      </footer>
    </div>
  )
}
