import { CircleAlert, Database } from 'lucide-react'

export function StatusNotice({ children, setup = false }: { children: string; setup?: boolean }) {
  const Icon = setup ? Database : CircleAlert
  return (
    <div className="status-notice" role="status">
      <Icon size={17} />
      <span>{children}</span>
    </div>
  )
}
