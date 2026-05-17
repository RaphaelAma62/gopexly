'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner, EmptyState } from '@/components/ui'
import type { Course, CourseLesson, CourseAssessment, CourseProgress } from '@/types'

export default function LearnPage() {
  const sb = createClient()
  const { user } = useAuth()
  const { toast, showToast } = useToast()

  const [courses, setCourses] = useState<Course[]>([])
  const [filtered, setFiltered] = useState<Course[]>([])
  const [progress, setProgress] = useState<Record<string, string[]>>({})
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [leaderboard, setLeaderboard] = useState<{ id: string; name: string | null; initials: string | null; points: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [todayDone, setTodayDone] = useState(0)

  // Lesson viewer
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [lessonIdx, setLessonIdx] = useState(0)
  const [assessments, setAssessments] = useState<CourseAssessment[]>([])
  const [answered, setAnswered] = useState<Record<string, number>>({})
  const [viewerOpen, setViewerOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    const [cRes, pRes, prRes, lbRes] = await Promise.all([
      sb.from('courses').select('*, profiles!courses_created_by_fkey(name)').eq('is_published', true).order('created_at', { ascending: false }),
      sb.from('course_progress').select('*').eq('user_id', user.id),
      sb.from('profiles').select('points,streak').eq('id', user.id).single(),
      sb.from('profiles').select('id,name,initials,points').order('points', { ascending: false }).limit(5)
    ])
    setCourses((cRes.data || []) as Course[])
    setFiltered((cRes.data || []) as Course[])
    const prog: Record<string, string[]> = {}
    const today = new Date().toDateString()
    let todayCount = 0
    ;(pRes.data || []).forEach((p: CourseProgress) => {
      if (!prog[p.course_id]) prog[p.course_id] = []
      prog[p.course_id].push(p.lesson_id)
      if (p.completed_at && new Date(p.completed_at).toDateString() === today) todayCount++
    })
    setProgress(prog)
    setTodayDone(todayCount)
    if (prRes.data) { setPoints(prRes.data.points || 0); setStreak(prRes.data.streak || 0) }
    setLeaderboard(lbRes.data || [])
    setLoading(false)
  }, [sb, user])

  useEffect(() => { loadData() }, [loadData])

  function filterCourses(f: string) {
    setFilter(f)
    if (f === 'all') { setFiltered(courses); return }
    setFiltered(courses.filter(c => c.category === f || c.difficulty === f))
  }

  async function openCourse(course: Course) {
    setActiveCourse(course)
    const { data: ls } = await sb.from('course_lessons').select('*').eq('course_id', course.id).order('lesson_order', { ascending: true })
    setLessons((ls || []) as CourseLesson[])
    setLessonIdx(0)
    setAnswered({})
    if (ls?.length) {
      const { data: as } = await sb.from('course_assessments').select('*').eq('course_id', course.id)
      setAssessments((as || []) as CourseAssessment[])
    }
    setViewerOpen(true)
  }

  async function answerQuestion(assessment: CourseAssessment, chosen: number) {
    if (answered[assessment.id] !== undefined) return
    setAnswered(prev => ({ ...prev, [assessment.id]: chosen }))
    if (chosen === assessment.correct_index) {
      showToast('+10 points! Correct answer!', 'ok')
      await awardPoints(10)
    }
  }

  async function markComplete() {
    if (!activeCourse || !user || !lessons[lessonIdx]) return
    const lesson = lessons[lessonIdx]
    await sb.from('course_progress').upsert(
      { user_id: user.id, course_id: activeCourse.id, lesson_id: lesson.id, completed: true, completed_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    )
    setProgress(prev => {
      const updated = { ...prev }
      if (!updated[activeCourse.id]) updated[activeCourse.id] = []
      if (!updated[activeCourse.id].includes(lesson.id)) updated[activeCourse.id] = [...updated[activeCourse.id], lesson.id]
      return updated
    })
    const pts = activeCourse.points_reward || 100
    await awardPoints(pts)
    showToast(`Course complete! +${pts} points earned!`, 'ok')
    setViewerOpen(false)
    setActiveCourse(null)
  }

  async function awardPoints(pts: number) {
    if (!user) return
    const newPts = points + pts
    await sb.from('profiles').update({ points: newPts }).eq('id', user.id)
    setPoints(newPts)
  }

  const currentLesson = lessons[lessonIdx]
  const lessonAssessments = assessments.filter(a => a.lesson_id === currentLesson?.id)
  const isLastLesson = lessonIdx === lessons.length - 1
  const totalDone = Object.values(progress).reduce((a, v) => a + v.length, 0)

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple to-primary text-white px-6 md:px-10 py-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-[26px] font-extrabold mb-1">📚 Learn &amp; Earn</h1>
            <p className="text-[13px] opacity-80">Master investing. Earn points for every lesson completed.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center bg-white/10 rounded-xl px-4 py-2.5">
              <div className="font-display text-[20px] font-extrabold">{points.toLocaleString()}</div>
              <div className="text-[9px] opacity-70 uppercase tracking-wide">My Points</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-2.5">
              <div className="font-display text-[20px] font-extrabold">{totalDone}</div>
              <div className="text-[9px] opacity-70 uppercase tracking-wide">Completed</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-2.5">
              <div className="font-display text-[20px] font-extrabold">🔥 {streak}</div>
              <div className="text-[9px] opacity-70 uppercase tracking-wide">Day Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily progress */}
      <div className="bg-surface border-b border-border px-6 py-3 mb-5 flex items-center gap-3">
        <div className="text-[12px] font-semibold text-text whitespace-nowrap">🎯 Today&apos;s Goal</div>
        <div className="flex-1 bg-gray-200 rounded h-2 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple to-primary rounded transition-all" style={{ width: `${Math.min(todayDone * 100, 100)}%` }} />
        </div>
        <div className="text-[12px] font-bold text-primary whitespace-nowrap">{todayDone} / 1 lessons</div>
      </div>

      <div className="px-4 md:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <div>
            {/* Filters */}
            <div className="flex gap-2 flex-wrap mb-4">
              {['all', 'Investing', 'Stock Market', 'Personal Finance', 'Beginner'].map(f => (
                <button key={f} onClick={() => filterCourses(f)}
                  className={cn('text-[12px] font-semibold px-3.5 py-1.5 rounded-full border transition-all',
                    filter === f ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary hover:text-primary')}>
                  {f === 'all' ? 'All Courses' : f}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon="📚" title="No courses yet" subtitle="The admin will publish courses here soon. Check back!" />
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(c => {
                  const done = (progress[c.id] || []).length
                  const total = c.lesson_count || 0
                  const pct = total > 0 ? Math.round(done / total * 100) : 0
                  return (
                    <div key={c.id} onClick={() => openCourse(c)}
                      className="bg-surface border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary-border hover:shadow-md transition-all">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold bg-primary-light text-primary px-2 py-0.5 rounded-full">{c.category}</span>
                          <span className="text-[10px] text-text-muted">{c.difficulty}</span>
                          {c.duration_mins ? <span className="text-[10px] text-text-muted">{c.duration_mins} min</span> : null}
                        </div>
                        <div className="font-display text-[16px] font-bold mb-1">{c.title}</div>
                        {c.description && <div className="text-[12px] text-text-secondary leading-relaxed mb-3 line-clamp-2">{c.description}</div>}
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-text-muted">
                            {(c as Course & { profiles?: { name?: string | null } }).profiles?.name && `By ${(c as Course & { profiles?: { name?: string | null } }).profiles?.name}`}
                          </div>
                          <div className="text-[11px] font-bold text-amber">🏆 {c.points_reward || 100} pts</div>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="px-4 pb-3">
                          <div className="bg-gray-200 rounded h-[5px] mb-1">
                            <div className="h-full rounded bg-gradient-to-r from-purple to-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {done}/{total} lessons{pct === 100 ? ' · ✓ Completed' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {/* Leaderboard */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <div className="font-display text-[13px] font-extrabold">🏅 Leaderboard</div>
              </div>
              <div className="p-3">
                {leaderboard.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="text-[14px] w-5">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                      {u.initials || (u.name?.charAt(0) || 'U')}
                    </div>
                    <div className="flex-1 text-[12px] font-semibold truncate">{u.name || 'User'}</div>
                    <div className="text-[12px] font-bold text-amber">{(u.points || 0).toLocaleString()} pts</div>
                  </div>
                ))}
              </div>
            </div>

            {/* My progress */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <div className="font-display text-[13px] font-extrabold">📖 My Progress</div>
              </div>
              <div className="p-4">
                {Object.keys(progress).length === 0 ? (
                  <div className="text-[12px] text-text-muted">Start a course to track progress.</div>
                ) : courses.filter(c => progress[c.id]?.length > 0).map(c => {
                  const done = progress[c.id].length
                  const total = c.lesson_count || 1
                  const pct = Math.round(done / total * 100)
                  return (
                    <div key={c.id} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="font-semibold truncate flex-1 mr-2">{c.title}</span>
                        <span className="text-primary font-bold flex-shrink-0">{pct}%</span>
                      </div>
                      <div className="bg-gray-200 rounded h-[5px]">
                        <div className="h-full rounded bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Badges */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <div className="font-display text-[13px] font-extrabold">🎖 My Badges</div>
              </div>
              <div className="grid grid-cols-4 gap-2 p-3">
                {[
                  { icon: '🏠', label: 'Member', earned: true },
                  { icon: '📚', label: 'First Lesson', earned: totalDone > 0 },
                  { icon: '🔥', label: '5 Day Streak', earned: streak >= 5 },
                  { icon: '⭐', label: '100 Points', earned: points >= 100 },
                  { icon: '🎓', label: 'Graduate', earned: Object.values(progress).some(v => v.length > 0) },
                  { icon: '💰', label: 'Investor', earned: false },
                  { icon: '📈', label: 'Trader', earned: false },
                  { icon: '🏆', label: 'Top 10', earned: false },
                ].map(b => (
                  <div key={b.label} className={cn('text-center p-2.5 rounded-xl',
                    b.earned ? 'bg-gain-bg border border-gain-border' : 'bg-gray-50')}>
                    <div className="text-[18px] mb-1">{b.icon}</div>
                    <div className="text-[9px] text-text-muted leading-tight">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson viewer modal */}
      {viewerOpen && activeCourse && currentLesson && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div className="font-display text-[16px] font-extrabold">{activeCourse.title} — {currentLesson.title}</div>
              <button onClick={() => setViewerOpen(false)} className="w-7 h-7 bg-gray-100 rounded-lg text-[12px] flex items-center justify-center hover:bg-gray-200">✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Video */}
              {currentLesson.video_url && (
                <div className="mb-4">
                  {currentLesson.video_url.includes('youtube') || currentLesson.video_url.includes('youtu.be') ? (
                    <iframe
                      className="w-full rounded-xl aspect-video bg-black"
                      src={currentLesson.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                      allowFullScreen
                    />
                  ) : (
                    <video className="w-full rounded-xl" controls src={currentLesson.video_url} />
                  )}
                </div>
              )}

              {/* Content */}
              {currentLesson.content && (
                <div className="text-[14px] text-text-secondary leading-relaxed mb-5 whitespace-pre-wrap">{currentLesson.content}</div>
              )}

              {/* Assessments */}
              {lessonAssessments.length > 0 && (
                <div className="bg-gray-50 border border-border rounded-xl p-4">
                  {lessonAssessments.map(q => {
                    const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string || '[]')
                    const chosen = answered[q.id]
                    return (
                      <div key={q.id}>
                        <div className="font-display text-[14px] font-bold mb-3">🎲 {q.question}</div>
                        <div className="flex flex-col gap-2">
                          {(opts as string[]).map((opt, i) => (
                            <button key={i} onClick={() => answerQuestion(q, i)} disabled={chosen !== undefined}
                              className={cn('w-full text-left px-4 py-2.5 rounded-xl border-[1.5px] text-[13px] transition-all',
                                chosen === undefined ? 'border-border bg-white hover:border-primary hover:bg-primary-light' :
                                i === q.correct_index ? 'border-gain bg-gain-bg text-gain' :
                                i === chosen ? 'border-loss bg-loss-bg text-loss' : 'border-border bg-gray-50 opacity-50')}>
                              {opt}
                            </button>
                          ))}
                        </div>
                        {chosen !== undefined && q.explanation && (
                          <div className="mt-3 bg-amber-bg rounded-xl p-3 text-[12px] text-amber">{q.explanation}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border flex-shrink-0">
              <div className="text-[12px] text-text-muted">Lesson {lessonIdx + 1} of {lessons.length}</div>
              <div className="flex gap-2">
                {lessonIdx > 0 && (
                  <button onClick={() => setLessonIdx(p => p - 1)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold hover:bg-gray-200">← Prev</button>
                )}
                {!isLastLesson && (
                  <button onClick={() => setLessonIdx(p => p + 1)} className="px-4 py-2 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark">Next →</button>
                )}
                {isLastLesson && (
                  <button onClick={markComplete} className="px-5 py-2 bg-gain text-white rounded-xl text-[13px] font-bold hover:bg-green-700">✓ Mark Complete</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
