'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner, EmptyState, Avatar } from '@/components/ui'
import { fmtTime } from '@/lib/utils'

interface Bookmark {
  id: string
  user_id: string
  post_id: string
  created_at: string
  posts: {
    id: string
    body: string
    likes_count: number
    comments_count: number
    created_at: string
    profiles: { name: string | null; initials: string | null } | null
  } | null
}

const FREE_LIMIT = 10

export default function Bookmarks() {
  const sb = createClient()
  const { user } = useAuth()
  const { toast, showToast } = useToast()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadBookmarks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadBookmarks() {
    if (!user) return
    const { data } = await sb.from('bookmarks')
      .select('id,user_id,post_id,created_at,posts(id,body,likes_count,comments_count,created_at,profiles!posts_user_id_fkey(name,initials))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setBookmarks((data || []) as unknown as Bookmark[])
    setLoading(false)
  }

  async function removeBookmark(id: string) {
    await sb.from('bookmarks').delete().eq('id', id)
    setBookmarks(prev => prev.filter(b => b.id !== id))
    showToast('Bookmark removed', 'ok')
  }

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-20">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">🔖 Saved Posts</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Posts you bookmarked to read later</p>
        </div>
        <div className="text-[12px] font-bold text-text-muted bg-gray-100 px-3 py-1.5 rounded-full">
          {bookmarks.length}/{FREE_LIMIT}
        </div>
      </div>

      {bookmarks.length >= FREE_LIMIT && (
        <div className="bg-gradient-to-r from-purple/10 to-primary/10 border border-primary-border rounded-2xl p-4 mb-5 flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div className="flex-1">
            <div className="font-bold text-[13px]">Bookmark limit reached — upgrade to Pro</div>
            <div className="text-[12px] text-text-secondary">Save unlimited posts with Gopexly Pro</div>
          </div>
          <button className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-xl flex-shrink-0">Upgrade</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="text-primary" /></div>
      ) : bookmarks.length === 0 ? (
        <EmptyState icon="🔖" title="No saved posts yet" subtitle="Tap the bookmark icon on any post to save it here" />
      ) : (
        <div className="flex flex-col gap-3">
          {bookmarks.map(b => {
            const post = b.posts
            if (!post) return null
            return (
              <div key={b.id} className="bg-surface border border-border rounded-2xl p-4 hover:border-primary-border hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 mb-2.5 flex-1 min-w-0">
                    <Avatar initials={post.profiles?.initials || post.profiles?.name?.charAt(0) || 'U'} size="md" />
                    <div className="min-w-0">
                      <div className="font-bold text-[13px]">{post.profiles?.name || 'User'}</div>
                      <div className="text-[11px] text-text-muted">{fmtTime(post.created_at)}</div>
                    </div>
                  </div>
                  <button onClick={() => removeBookmark(b.id)}
                    className="text-[11px] text-loss bg-loss-bg px-2.5 py-1.5 rounded-lg hover:bg-loss hover:text-white transition-all flex-shrink-0">
                    Remove
                  </button>
                </div>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-3 line-clamp-4">{post.body}</p>
                <div className="flex items-center gap-4 pt-3 border-t border-border">
                  <span className="text-[12px] text-text-muted">❤️ {post.likes_count}</span>
                  <span className="text-[12px] text-text-muted">💬 {post.comments_count}</span>
                  <span className="text-[11px] text-text-muted ml-auto">Saved {fmtTime(b.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
