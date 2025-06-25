# InterviewAI MVP Implementation Guide

## 🚀 Step-by-Step Implementation Guide

### **Prerequisites Checklist**
- [ ] Bolt.new account with active project
- [ ] Supabase account (free tier is sufficient for MVP)
- [ ] ElevenLabs account (Creator plan - $22/month)
- [ ] Stripe account (for payments)
- [ ] Basic understanding of Next.js and TypeScript

---

## 📋 Phase 1: Foundation Setup (Days 1-7)

### **Day 1-2: Supabase Project Setup**

#### **Step 1: Create Supabase Project**
1. Go to [supabase.com](https://supabase.com) and create new project
2. Choose region closest to your target users
3. Set strong database password and save it securely
4. Wait for project to be ready (~2 minutes)

#### **Step 2: Configure Environment Variables in Bolt**
```bash
# Add these to your Bolt project environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### **Step 3: Database Schema Creation**
Run these SQL commands in Supabase SQL Editor:

```sql
-- 1. Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  industry TEXT CHECK (industry IN ('technology', 'finance', 'healthcare', 'marketing', 'general')),
  experience_level TEXT CHECK (experience_level IN ('entry', 'mid', 'senior', 'executive')),
  goals TEXT[],
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

```sql
-- 2. Create subscriptions table
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes and RLS
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());
```

```sql
-- 3. Create questions table
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('behavioral', 'technical', 'situational', 'cultural')),
  expected_duration INTEGER, -- seconds
  tags TEXT[],
  scoring_criteria JSONB,
  follow_up_questions TEXT[],
  sample_answer_points TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_questions_industry ON questions(industry);
CREATE INDEX idx_questions_difficulty ON questions(difficulty_level);
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_active ON questions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_questions_search ON questions USING gin(to_tsvector('english', question_text));

-- RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are viewable by authenticated users" ON questions
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
```

```sql
-- 4. Create interview_sessions table
CREATE TABLE interview_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  difficulty_level INTEGER DEFAULT 1,
  session_type TEXT DEFAULT 'practice' CHECK (session_type IN ('practice', 'assessment', 'custom')),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  
  -- Session configuration
  target_duration INTEGER, -- minutes
  question_count INTEGER,
  voice_id TEXT,
  
  -- Session data
  questions JSONB DEFAULT '[]',
  responses JSONB DEFAULT '[]',
  audio_urls JSONB DEFAULT '{}',
  
  -- Analytics
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  category_scores JSONB DEFAULT '{}',
  speaking_metrics JSONB DEFAULT '{}',
  
  -- Feedback
  feedback_summary TEXT,
  strengths TEXT[],
  areas_for_improvement TEXT[],
  recommended_actions TEXT[],
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes and RLS
CREATE INDEX idx_sessions_user_created ON interview_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_status ON interview_sessions(status);
CREATE INDEX idx_sessions_industry ON interview_sessions(industry);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON interview_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions" ON interview_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON interview_sessions
  FOR UPDATE USING (user_id = auth.uid());
```

#### **Step 4: Create Database Functions**
```sql
-- Function to get user subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid UUID)
RETURNS TABLE (
  plan_type TEXT,
  status TEXT,
  is_active BOOLEAN,
  current_period_end TIMESTAMPTZ,
  trial_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(s.plan_type, 'free') as plan_type,
    COALESCE(s.status, 'inactive') as status,
    COALESCE(s.status = 'active' AND s.current_period_end > NOW(), false) as is_active,
    s.current_period_end,
    COALESCE(s.trial_end IS NOT NULL AND s.trial_end > NOW(), false) as trial_active
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  WHERE p.id = user_uuid
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```sql
-- Function to get interview questions
CREATE OR REPLACE FUNCTION get_interview_questions(
  p_industry TEXT,
  p_difficulty INTEGER,
  p_count INTEGER,
  p_user_id UUID,
  p_exclude_recent_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  question_text TEXT,
  category TEXT,
  difficulty_level INTEGER,
  expected_duration INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.question_text,
    q.category,
    q.difficulty_level,
    q.expected_duration
  FROM questions q
  WHERE q.industry = p_industry 
    AND q.difficulty_level <= p_difficulty
    AND q.is_active = TRUE
    AND q.id NOT IN (
      SELECT DISTINCT (jsonb_array_elements_text(questions::jsonb))::UUID
      FROM interview_sessions
      WHERE user_id = p_user_id
        AND created_at > NOW() - INTERVAL '1 day' * p_exclude_recent_days
    )
  ORDER BY RANDOM()
  LIMIT p_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **Step 5: Seed Question Database**
Create and run this script to populate questions:

```sql
-- Insert sample questions for technology industry
INSERT INTO questions (industry, category, difficulty_level, question_text, question_type, expected_duration, tags) VALUES
-- Technology - Behavioral Questions
('technology', 'behavioral', 1, 'Tell me about yourself and your experience in software development.', 'behavioral', 120, ARRAY['introduction', 'experience']),
('technology', 'behavioral', 2, 'Describe a challenging technical problem you solved recently. Walk me through your approach.', 'behavioral', 180, ARRAY['problem-solving', 'technical']),
('technology', 'behavioral', 3, 'Tell me about a time when you had to learn a new technology quickly. How did you approach it?', 'behavioral', 150, ARRAY['learning', 'adaptability']),
('technology', 'behavioral', 2, 'Describe a situation where you had to work with a difficult team member. How did you handle it?', 'behavioral', 150, ARRAY['teamwork', 'conflict-resolution']),
('technology', 'behavioral', 3, 'Tell me about a project where you had to make a technical decision with incomplete information.', 'behavioral', 180, ARRAY['decision-making', 'uncertainty']),

-- Technology - Technical Questions
('technology', 'technical', 2, 'Explain the difference between REST and GraphQL APIs. When would you use each?', 'technical', 180, ARRAY['api', 'architecture']),
('technology', 'technical', 3, 'How would you approach debugging a performance issue in a web application?', 'technical', 200, ARRAY['debugging', 'performance']),
('technology', 'technical', 4, 'Describe your experience with microservices architecture. What are the main challenges?', 'technical', 240, ARRAY['architecture', 'microservices']),
('technology', 'technical', 3, 'How do you ensure code quality in your development process?', 'technical', 150, ARRAY['code-quality', 'testing']),
('technology', 'technical', 4, 'Explain how you would design a system to handle 1 million concurrent users.', 'technical', 300, ARRAY['scalability', 'system-design']);

-- Finance - Behavioral Questions  
INSERT INTO questions (industry, category, difficulty_level, question_text, question_type, expected_duration, tags) VALUES
('finance', 'behavioral', 1, 'Tell me about your background in finance and what interests you about this role.', 'behavioral', 120, ARRAY['introduction', 'motivation']),
('finance', 'behavioral', 2, 'Describe a time when you had to analyze complex financial data. What was your approach?', 'behavioral', 180, ARRAY['analysis', 'data']),
('finance', 'behavioral', 3, 'Tell me about a financial model you built. What assumptions did you make and how did you validate them?', 'behavioral', 200, ARRAY['modeling', 'assumptions']),
('finance', 'behavioral', 2, 'Describe a situation where you had to present financial information to non-financial stakeholders.', 'behavioral', 150, ARRAY['communication', 'presentation']),
('finance', 'behavioral', 4, 'Tell me about a time when your financial analysis led to a significant business decision.', 'behavioral', 180, ARRAY['impact', 'decision-making']);

-- Healthcare - Behavioral Questions
INSERT INTO questions (industry, category, difficulty_level, question_text, question_type, expected_duration, tags) VALUES
('healthcare', 'behavioral', 1, 'What motivated you to pursue a career in healthcare?', 'behavioral', 120, ARRAY['motivation', 'career']),
('healthcare', 'behavioral', 2, 'Describe a challenging patient interaction and how you handled it.', 'behavioral', 180, ARRAY['patient-care', 'communication']),
('healthcare', 'behavioral', 3, 'Tell me about a time when you had to make a difficult ethical decision in your healthcare practice.', 'behavioral', 200, ARRAY['ethics', 'decision-making']),
('healthcare', 'behavioral', 2, 'How do you stay current with medical research and best practices?', 'behavioral', 150, ARRAY['learning', 'professional-development']),
('healthcare', 'behavioral', 4, 'Describe a situation where you had to collaborate with a multidisciplinary team.', 'behavioral', 180, ARRAY['teamwork', 'collaboration']);

-- Marketing - Behavioral Questions
INSERT INTO questions (industry, category, difficulty_level, question_text, question_type, expected_duration, tags) VALUES
('marketing', 'behavioral', 1, 'Tell me about your marketing background and what excites you about this field.', 'behavioral', 120, ARRAY['introduction', 'passion']),
('marketing', 'behavioral', 2, 'Describe a successful marketing campaign you worked on. What made it successful?', 'behavioral', 180, ARRAY['campaign', 'success']),
('marketing', 'behavioral', 3, 'Tell me about a time when a marketing initiative didn't go as planned. How did you handle it?', 'behavioral', 180, ARRAY['failure', 'adaptability']),
('marketing', 'behavioral', 2, 'How do you measure the success of your marketing efforts?', 'behavioral', 150, ARRAY['analytics', 'measurement']),
('marketing', 'behavioral', 3, 'Describe how you've used data to improve marketing performance.', 'behavioral', 180, ARRAY['data-driven', 'optimization']);

-- General - Universal Questions
INSERT INTO questions (industry, category, difficulty_level, question_text, question_type, expected_duration, tags) VALUES
('general', 'behavioral', 1, 'Tell me about yourself and your professional background.', 'behavioral', 120, ARRAY['introduction']),
('general', 'behavioral', 1, 'Why are you interested in this position?', 'behavioral', 90, ARRAY['motivation', 'role-fit']),
('general', 'behavioral', 2, 'What are your greatest strengths?', 'behavioral', 120, ARRAY['strengths', 'self-awareness']),
('general', 'behavioral', 2, 'What is your biggest weakness?', 'behavioral', 120, ARRAY['weaknesses', 'self-improvement']),
('general', 'behavioral', 1, 'Where do you see yourself in five years?', 'behavioral', 120, ARRAY['career-goals', 'vision']),
('general', 'behavioral', 2, 'Describe a time when you faced a significant challenge at work.', 'behavioral', 180, ARRAY['challenges', 'problem-solving']),
('general', 'behavioral', 2, 'Tell me about a time when you had to work under pressure.', 'behavioral', 150, ARRAY['pressure', 'stress-management']),
('general', 'behavioral', 3, 'Describe a situation where you had to lead a team or project.', 'behavioral', 180, ARRAY['leadership', 'project-management']),
('general', 'behavioral', 2, 'How do you handle criticism or feedback?', 'behavioral', 120, ARRAY['feedback', 'growth-mindset']),
('general', 'behavioral', 1, 'What questions do you have for me?', 'behavioral', 120, ARRAY['questions', 'engagement']);
```

### **Day 3-4: Authentication Implementation**

#### **Step 1: Install Supabase Client**
In your Bolt project, create this file:

```typescript
// lib/supabase.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          industry: string | null
          experience_level: string | null
          goals: string[] | null
          timezone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          industry?: string | null
          experience_level?: string | null
          goals?: string[] | null
          timezone?: string | null
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          industry?: string | null
          experience_level?: string | null
          goals?: string[] | null
          timezone?: string | null
          updated_at?: string
        }
      }
      // Add other table types as needed
    }
  }
}
```

#### **Step 2: Create Authentication Components**

```typescript
// components/auth/AuthForm.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AuthFormProps {
  mode: 'signin' | 'signup'
  onSuccess?: () => void
}

export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (error) throw error

        if (data.user && !data.session) {
          setMessage('Check your email for a verification link')
        } else {
          // Create profile
          await supabase.from('profiles').insert({
            id: data.user!.id,
            email: data.user!.email!,
            full_name: fullName,
          })
          
          onSuccess?.()
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        onSuccess?.()
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'signup' && (
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <Input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>

      {message && (
        <div className={`text-sm ${message.includes('error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Loading...' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
      </Button>
    </form>
  )
}
```

```typescript
// components/auth/AuthProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/auth-helpers-nextjs'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

#### **Step 3: Create Authentication Pages**

```typescript
// app/auth/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { AuthForm } from '@/components/auth/AuthForm'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">
            {mode === 'signin' ? 'Welcome Back' : 'Get Started'}
          </h1>
          <p className="text-gray-600">
            {mode === 'signin' 
              ? 'Sign in to continue your interview practice' 
              : 'Create your account to start practicing'
            }
          </p>
        </div>

        <AuthForm mode={mode} onSuccess={handleSuccess} />

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {mode === 'signin' 
              ? "Don't have an account? Sign up" 
              : 'Already have an account? Sign in'
            }
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

#### **Step 4: Update App Layout**

```typescript
// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'InterviewAI - Master Your Interview Skills',
  description: 'Practice and improve your interview skills with AI-powered voice interviews.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

### **Day 5-7: Core UI Framework & Navigation**

#### **Step 1: Create Protected Route Component**

```typescript
// components/ProtectedRoute.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export function ProtectedRoute({ children, redirectTo = '/auth' }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
```

#### **Step 2: Create Dashboard Layout**

```typescript
// app/dashboard/layout.tsx
'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardNav } from '@/components/DashboardNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <DashboardNav />
        <main className="container mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
```

```typescript
// components/DashboardNav.tsx
'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'

export function DashboardNav() {
  const { user, signOut } = useAuth()

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-2xl font-bold gradient-text">
              InterviewAI
            </Link>
            
            <div className="hidden md:flex space-x-6">
              <Link 
                href="/dashboard" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link 
                href="/interview/new" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Practice
              </Link>
              <Link 
                href="/dashboard/history" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                History
              </Link>
              <Link 
                href="/dashboard/settings" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Settings
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {user?.email}
            </span>
            <Button 
              variant="outline" 
              onClick={signOut}
              size="sm"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
```

#### **Step 3: Create Dashboard Home Page**

```typescript
// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface DashboardStats {
  totalInterviews: number
  averageScore: number
  lastInterview: string | null
  currentStreak: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadDashboardStats()
    }
  }, [user])

  const loadDashboardStats = async () => {
    try {
      const { data: sessions, error } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (error) throw error

      const totalInterviews = sessions?.length || 0
      const averageScore = sessions?.length 
        ? sessions.reduce((sum, session) => sum + (session.overall_score || 0), 0) / sessions.length
        : 0
      const lastInterview = sessions?.[0]?.created_at || null

      setStats({
        totalInterviews,
        averageScore: Math.round(averageScore),
        lastInterview,
        currentStreak: 0 // TODO: Calculate streak
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading dashboard...</div>
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl p-8"
      >
        <h1 className="text-3xl font-bold mb-4">
          Welcome back! 👋
        </h1>
        <p className="text-gray-600 mb-6">
          Ready to practice your interview skills? Start a new session or review your progress.
        </p>
        
        <div className="flex gap-4">
          <Link href="/interview/new">
            <Button size="lg" className="btn-primary">
              Start Practice Interview
            </Button>
          </Link>
          <Link href="/dashboard/history">
            <Button variant="outline" size="lg">
              View History
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Total Interviews
          </h3>
          <p className="text-3xl font-bold text-blue-600">
            {stats?.totalInterviews || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Average Score
          </h3>
          <p className="text-3xl font-bold text-green-600">
            {stats?.averageScore || 0}%
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Current Streak
          </h3>
          <p className="text-3xl font-bold text-purple-600">
            {stats?.currentStreak || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Last Interview
          </h3>
          <p className="text-sm text-gray-600">
            {stats?.lastInterview 
              ? new Date(stats.lastInterview).toLocaleDateString()
              : 'No interviews yet'
            }
          </p>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-3xl shadow-xl p-8"
      >
        <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/interview/new?industry=technology">
            <div className="p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all">
              <h3 className="font-semibold mb-2">Tech Interview</h3>
              <p className="text-sm text-gray-600">Practice technical and behavioral questions</p>
            </div>
          </Link>
          
          <Link href="/interview/new?industry=finance">
            <div className="p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all">
              <h3 className="font-semibold mb-2">Finance Interview</h3>
              <p className="text-sm text-gray-600">Financial analysis and case studies</p>
            </div>
          </Link>
          
          <Link href="/interview/new?industry=general">
            <div className="p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all">
              <h3 className="font-semibold mb-2">General Interview</h3>
              <p className="text-sm text-gray-600">Common interview questions</p>
            </div>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
```

---

## 🎙️ Phase 2: ElevenLabs Integration (Days 8-14)

### **Day 8-10: ElevenLabs Setup**

#### **Step 1: Add ElevenLabs API Key**
Add to your environment variables:
```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

#### **Step 2: Create Supabase Edge Function**
In Supabase dashboard, go to "Edge Functions" and create:

```typescript
// supabase/functions/generate-speech/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface TTSRequest {
  text: string
  voice_id?: string
  cache_key?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voice_id = 'EXAVITQu4vr4xnSDxMaL', cache_key }: TTSRequest = await req.json()

    console.log('Generating speech for:', text.substring(0, 50) + '...')

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', response.status, errorText)
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error in generate-speech function:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate speech' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

#### **Step 3: Deploy Edge Function**
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref your-project-ref`
4. Deploy function: `supabase functions deploy generate-speech`
5. Set secrets: `supabase secrets set ELEVENLABS_API_KEY=your_key`

#### **Step 4: Create Audio Service**

```typescript
// lib/audio-service.ts
class AudioService {
  private currentAudio: HTMLAudioElement | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []

  async generateQuestionAudio(questionText: string, voiceId?: string): Promise<string> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          text: questionText,
          voice_id: voiceId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate speech')
      }

      const audioBlob = await response.blob()
      return URL.createObjectURL(audioBlob)
    } catch (error) {
      console.error('Audio generation error:', error)
      throw error
    }
  }

  async playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stopAudio() // Stop any currently playing audio
      
      this.currentAudio = new Audio(audioUrl)
      this.currentAudio.onended = () => resolve()
      this.currentAudio.onerror = () => reject(new Error('Audio playback failed'))
      
      this.currentAudio.play().catch(reject)
    })
  }

  stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      })
      
      this.audioChunks = []
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.start()
    } catch (error) {
      console.error('Error starting recording:', error)
      throw error
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        resolve(audioBlob)
      }

      this.mediaRecorder.stop()
      
      // Stop all tracks to release microphone
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
      }
    })
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  isPlaying(): boolean {
    return this.currentAudio && !this.currentAudio.paused
  }
}

export const audioService = new AudioService()
```

---

**Continue with remaining implementation steps...**

This implementation guide provides the detailed, step-by-step process for building the MVP. Each step includes exact code, configurations, and commands needed. The guide continues with:

- Stripe payment integration
- Interview flow implementation  
- Question management system
- Feedback and analytics
- UI polish and testing
- Launch preparation

Would you like me to continue with the next phases of the implementation guide?