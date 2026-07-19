import {
  Flag,
  MessageCircle,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ensureAnonymousSession, isSupabaseConfigured, supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import type { BbsPost, VoteChoice } from '../types/community'
import { StatusNotice } from './StatusNotice'

type SortMode = 'new' | 'helpful'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function BbsBoard({ courseId }: { courseId: string }) {
  const [posts, setPosts] = useState<BbsPost[]>([])
  const [votes, setVotes] = useState<Record<string, VoteChoice>>({})
  const [body, setBody] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('new')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [submitting, setSubmitting] = useState(false)
  const [busyPostId, setBusyPostId] = useState<string | null>(null)
  const [reportingPostId, setReportingPostId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadBoard = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      await ensureAnonymousSession()
      const [{ data: postData, error: postError }, { data: voteData, error: voteError }] =
        await Promise.all([
          supabase
            .from('bbs_posts')
            .select('id,course_id,anon_label,body,like_count,dislike_count,created_at')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('bbs_votes').select('post_id,choice'),
        ])
      if (postError) throw postError
      if (voteError) throw voteError
      setPosts((postData ?? []) as BbsPost[])
      setVotes(
        Object.fromEntries(
          (voteData ?? []).map((vote) => [vote.post_id as string, vote.choice as VoteChoice]),
        ),
      )
    } catch (error) {
      setMessage(getErrorMessage(error, 'BBSを読み込めませんでした'))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  const sortedPosts = useMemo(() => {
    if (sortMode === 'new') return posts
    return [...posts].sort(
      (a, b) => b.like_count - b.dislike_count - (a.like_count - a.dislike_count),
    )
  }, [posts, sortMode])

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedBody = body.trim()
    if (!supabase || !trimmedBody) return
    setSubmitting(true)
    setMessage(null)
    try {
      await ensureAnonymousSession()
      const { error } = await supabase.from('bbs_posts').insert({
        course_id: courseId,
        body: trimmedBody,
      })
      if (error) throw error
      setBody('')
      await loadBoard()
    } catch (error) {
      setMessage(getErrorMessage(error, '投稿できませんでした'))
    } finally {
      setSubmitting(false)
    }
  }

  async function vote(postId: string, choice: VoteChoice) {
    if (!supabase || busyPostId) return
    setBusyPostId(postId)
    setMessage(null)
    try {
      await ensureAnonymousSession()
      const previous = votes[postId]
      const result = previous === choice
        ? await supabase.from('bbs_votes').delete().eq('post_id', postId)
        : previous
          ? await supabase.from('bbs_votes').update({ choice }).eq('post_id', postId)
          : await supabase.from('bbs_votes').insert({ post_id: postId, choice })
      if (result.error) throw result.error
      await loadBoard()
    } catch (error) {
      setMessage(getErrorMessage(error, '投票できませんでした'))
    } finally {
      setBusyPostId(null)
    }
  }

  async function report(postId: string, reason: string) {
    if (!supabase) return
    setBusyPostId(postId)
    setMessage(null)
    try {
      await ensureAnonymousSession()
      const { error } = await supabase.from('bbs_reports').insert({
        post_id: postId,
        reason,
        details: null,
      })
      if (error) {
        if (error.code === '23505') throw new Error('この投稿はすでに通報済みです')
        throw error
      }
      setMessage('通報を受け付けました')
      setReportingPostId(null)
    } catch (error) {
      setMessage(getErrorMessage(error, '通報できませんでした'))
    } finally {
      setBusyPostId(null)
    }
  }

  if (!isSupabaseConfigured) {
    return <StatusNotice setup>BBSは準備中です。Supabase接続後に投稿できるようになります。</StatusNotice>
  }

  return (
    <section className="board-stack" aria-label="BBS">
      <form className="composer" onSubmit={submitPost}>
        <div className="composer-heading">
          <div>
            <strong>この授業について投稿</strong>
            <span>同じ科目では同じ匿名名が表示されます</span>
          </div>
          <span className="character-count">{body.length}/1000</span>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="課題、履修の相談、授業の進み方など"
          aria-label="BBS投稿本文"
        />
        <div className="composer-actions">
          <p>個人情報や誹謗中傷は投稿しないでください。</p>
          <button className="primary-button" type="submit" disabled={!body.trim() || submitting}>
            <Send size={16} />
            {submitting ? '送信中' : '投稿する'}
          </button>
        </div>
      </form>

      {message && <StatusNotice>{message}</StatusNotice>}

      <div className="board-toolbar">
        <div className="result-count">
          <MessageCircle size={17} />
          {posts.length}件
        </div>
        <div className="segmented-control" aria-label="投稿の並べ替え">
          <button type="button" className={sortMode === 'new' ? 'active' : ''} onClick={() => setSortMode('new')}>
            新着順
          </button>
          <button type="button" className={sortMode === 'helpful' ? 'active' : ''} onClick={() => setSortMode('helpful')}>
            評価順
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">読み込み中...</div>
      ) : sortedPosts.length === 0 ? (
        <div className="empty-state">まだ投稿はありません。最初の話題を書いてみましょう。</div>
      ) : (
        <ol className="post-list">
          {sortedPosts.map((post, index) => (
            <li className="post-item" key={post.id}>
              <div className="post-meta">
                <div>
                  <span className="post-number">#{posts.length - index}</span>
                  <strong>{post.anon_label}</strong>
                </div>
                <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
              </div>
              <p className="post-body">{post.body}</p>
              <div className="post-actions">
                <button
                  type="button"
                  className={votes[post.id] === 'up' ? 'vote-button active-up' : 'vote-button'}
                  onClick={() => void vote(post.id, 'up')}
                  disabled={busyPostId === post.id}
                  aria-label="参考になった"
                >
                  <ThumbsUp size={16} /> {post.like_count}
                </button>
                <button
                  type="button"
                  className={votes[post.id] === 'down' ? 'vote-button active-down' : 'vote-button'}
                  onClick={() => void vote(post.id, 'down')}
                  disabled={busyPostId === post.id}
                  aria-label="参考にならなかった"
                >
                  <ThumbsDown size={16} /> {post.dislike_count}
                </button>
                <button
                  type="button"
                  className="report-button"
                  onClick={() => setReportingPostId(reportingPostId === post.id ? null : post.id)}
                >
                  <Flag size={15} /> 通報
                </button>
              </div>
              {reportingPostId === post.id && (
                <div className="report-menu" aria-label="通報理由">
                  <span>理由を選択</span>
                  <button type="button" onClick={() => void report(post.id, 'harassment')}>誹謗中傷</button>
                  <button type="button" onClick={() => void report(post.id, 'personal_info')}>個人情報</button>
                  <button type="button" onClick={() => void report(post.id, 'spam')}>宣伝・連投</button>
                  <button type="button" onClick={() => void report(post.id, 'other')}>その他</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
