// ─────────────────────────────────────────────
// types/index.ts  — all shared TypeScript types
// ─────────────────────────────────────────────

// ── AUTH / USER ───────────────────────────────
export interface UserSession {
  id: string
  name: string
  firstName: string
  initials: string
  username: string
  email: string
  role: 'user' | 'editor' | 'admin'
  joined?: string
}

export interface Profile {
  id: string
  name: string | null
  first_name: string | null
  initials: string | null
  username: string | null
  phone: string | null
  bio: string | null
  location: string | null
  country: string | null
  cover_color: string | null
  role: 'user' | 'editor' | 'admin'
  is_verified: boolean
  is_suspended: boolean
  suspension_reason: string | null
  share_performance: boolean
  portfolio_pct_gain: number | null
  portfolio_pct_period: string | null
  followers_count: number
  following_count: number
  points: number
  streak: number
  total_posts: number
  last_seen: string | null
  joined_at: string | null
}

// ── POSTS ─────────────────────────────────────
export interface TickerHolding {
  ticker: string
  i_hold: boolean
  my_pct: number | null
  type?: 'news'
  news_id?: string
  title?: string
}

export interface Post {
  id: string
  user_id: string
  body: string
  ticker_holdings: TickerHolding[]
  portfolio_pct_gain: number | null
  portfolio_period: string | null
  likes_count: number
  comments_count: number
  created_at: string
  profiles?: Pick<Profile, 'name' | 'initials' | 'role' | 'share_performance' | 'portfolio_pct_gain'>
}

export interface PostImage {
  id: string
  post_id: string
  image_url: string
  created_at: string
}

export interface PostReaction {
  post_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  body: string
  likes_count: number
  created_at: string
  profiles?: Pick<Profile, 'name' | 'initials'>
}

export interface Like {
  post_id: string
  user_id: string
  created_at: string
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

// ── HOLDINGS / PORTFOLIO ──────────────────────
export interface Holding {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  shares: number
  buy_price: number
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  icon: string
  target_amount: number
  saved_amount: number
  monthly_contribution: number
  created_at: string
}

// ── MARKET ────────────────────────────────────
export interface StockPrice {
  ticker: string
  company_name: string | null
  price: number
  prev_close: number | null
  change_pct: number
  change_amt: number
  volume: number | null
  market_cap: string | null
  last_updated: string | null
  is_market_open: boolean
}

// ── NEWS ──────────────────────────────────────
export interface NewsPost {
  id: string
  title: string
  body: string
  source: string | null
  image_url: string | null
  author_id: string
  created_at: string
  profiles?: Pick<Profile, 'name'>
}

// ── COURSES / LEARN ───────────────────────────
export interface Course {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  duration_mins: number
  points_reward: number
  lesson_count: number
  created_by: string | null
  is_published: boolean
  created_at: string
  profiles?: Pick<Profile, 'name'>
}

export interface CourseLesson {
  id: string
  course_id: string
  title: string
  content: string | null
  video_url: string | null
  lesson_type: 'text' | 'video' | 'audio'
  lesson_order: number
  duration_mins: number
  created_at: string
}

export interface CourseAssessment {
  id: string
  course_id: string
  lesson_id: string
  question: string
  options: string[]
  correct_index: number
  explanation: string | null
  created_at: string
}

export interface CourseProgress {
  id: string
  user_id: string
  course_id: string
  lesson_id: string
  completed: boolean
  score: number
  completed_at: string | null
}

// ── UI HELPERS ────────────────────────────────
export type ToastType = 'ok' | 'err' | 'info' | ''

export interface ToastState {
  message: string
  type: ToastType
  visible: boolean
}

export type FeedTab = 'fy' | 'fl' | 'nw'

export interface PriceMap {
  [ticker: string]: {
    price: number
    change_pct: number
    company_name: string
  }
}

// ── API RESPONSES ─────────────────────────────
export interface DeleteUserResult {
  success: boolean
  user_id?: string
  deleted?: {
    posts: number
    comments: number
    likes: number
    follows: number
    holdings: number
    goals: number
    reactions: number
    course_progress: number
  }
  error?: string
}

// ── DATABASE HELPERS ──────────────────────────
export type Tables = {
  profiles: Profile
  posts: Post
  post_images: PostImage
  post_reactions: PostReaction
  comments: Comment
  likes: Like
  follows: Follow
  holdings: Holding
  goals: Goal
  stock_prices: StockPrice
  news_posts: NewsPost
  courses: Course
  course_lessons: CourseLesson
  course_assessments: CourseAssessment
  course_progress: CourseProgress
}
