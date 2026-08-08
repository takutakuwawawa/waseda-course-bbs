import { Link } from 'react-router-dom'

export function PostingPolicyNotice() {
  return (
    <p className="posting-policy-notice">
      投稿すると<Link to="/guide">利用規約</Link>に同意したものとみなします。
      犯罪予告や差し迫った危険は、記録を保全して警察等へ通報します。
    </p>
  )
}
