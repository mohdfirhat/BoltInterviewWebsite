# InterviewAI MVP Technical Specifications

## 🏗️ Technical Architecture Overview

### **System Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────┤
│                API Gateway Layer                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────────────┐  │
│  │   Supabase   │  ElevenLabs  │     Stripe API       │  │
│  │   Backend    │     TTS      │     Payments         │  │
│  └──────────────┴──────────────┴──────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────────────┐  │
│  │ PostgreSQL   │    Storage   │     Auth & RLS       │  │
│  │   Database   │   (Files)    │     Security         │  │
│  └──────────────┴──────────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### **Technology Stack**
- **Frontend**: Next.js 13+ with TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Voice AI**: ElevenLabs Text-to-Speech API
- **Payments**: Stripe API with Supabase integration
- **Deployment**: Bolt.new platform with automatic deployments
- **Monitoring**: Supabase Analytics + custom metrics

---

## 🗄️ Database Schema Design

### **Core Tables Structure**

#### **profiles** (extends auth.users)
```sql
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

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

#### **subscriptions**
```sql
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

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());
```

#### **questions**
```sql
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

-- Indexes for performance
CREATE INDEX idx_questions_industry ON questions(industry);
CREATE INDEX idx_questions_difficulty ON questions(difficulty_level);
CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_active ON questions(is_active) WHERE is_active = TRUE;

-- Full-text search
CREATE INDEX idx_questions_search ON questions USING gin(to_tsvector('english', question_text));

-- RLS (questions are public)
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions are viewable by authenticated users" ON questions
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
```

#### **interview_sessions**
```sql
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
  questions JSONB DEFAULT '[]', -- array of question IDs
  responses JSONB DEFAULT '[]', -- array of response objects
  audio_urls JSONB DEFAULT '{}', -- question_id -> audio_url mapping
  
  -- Analytics
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  category_scores JSONB DEFAULT '{}', -- category -> score mapping
  speaking_metrics JSONB DEFAULT '{}', -- pace, clarity, confidence scores
  
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

-- Indexes
CREATE INDEX idx_sessions_user_created ON interview_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_status ON interview_sessions(status);
CREATE INDEX idx_sessions_industry ON interview_sessions(industry);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON interview_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions" ON interview_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON interview_sessions
  FOR UPDATE USING (user_id = auth.uid());
```

#### **user_responses**
```sql
CREATE TABLE user_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Response data
  transcript TEXT,
  audio_url TEXT,
  recording_duration INTEGER, -- seconds
  
  -- Analysis results
  content_score INTEGER CHECK (content_score BETWEEN 0 AND 100),
  delivery_score INTEGER CHECK (delivery_score BETWEEN 0 AND 100),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  
  -- Speech analytics
  speech_rate INTEGER, -- words per minute
  pause_count INTEGER,
  filler_word_count INTEGER,
  average_volume DECIMAL(3,2),
  confidence_level INTEGER CHECK (confidence_level BETWEEN 0 AND 100),
  
  -- Feedback
  specific_feedback TEXT,
  improvement_suggestions TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_responses_session ON user_responses(session_id);
CREATE INDEX idx_responses_user ON user_responses(user_id);
CREATE INDEX idx_responses_question ON user_responses(question_id);

-- RLS
ALTER TABLE user_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own responses" ON user_responses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own responses" ON user_responses
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

### **Database Functions**

#### **Get User Subscription Status**
```sql
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
    s.plan_type,
    s.status,
    (s.status = 'active' AND s.current_period_end > NOW()) as is_active,
    s.current_period_end,
    (s.trial_end IS NOT NULL AND s.trial_end > NOW()) as trial_active
  FROM subscriptions s
  WHERE s.user_id = user_uuid
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **Get Interview Questions**
```sql
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
      -- Exclude recently used questions
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

---

## 🎙️ ElevenLabs Integration

### **Voice Configuration**
```typescript
// Voice configuration types
interface VoiceSettings {
  stability: number; // 0.0 - 1.0
  similarity_boost: number; // 0.0 - 1.0
  style?: number; // 0.0 - 1.0 (for v2 models)
  use_speaker_boost?: boolean;
}

interface ElevenLabsConfig {
  api_key: string;
  voice_id: string;
  model_id: 'eleven_monolingual_v1' | 'eleven_multilingual_v1' | 'eleven_multilingual_v2';
  voice_settings: VoiceSettings;
  output_format: 'mp3_44100_128' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000';
}

// Professional interviewer voice presets
const INTERVIEWER_VOICES: Record<string, ElevenLabsConfig> = {
  professional_female: {
    voice_id: 'EXAVITQu4vr4xnSDxMaL', // Bella
    model_id: 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.75,
      similarity_boost: 0.85,
      use_speaker_boost: true
    },
    output_format: 'mp3_44100_128'
  },
  professional_male: {
    voice_id: 'VR6AewLTigWG4xSOukaG', // Arnold
    model_id: 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.7,
      similarity_boost: 0.8,
      use_speaker_boost: true
    },
    output_format: 'mp3_44100_128'
  },
  friendly_female: {
    voice_id: 'ThT5KcBeYPX3keUQqHPh', // Dorothy
    model_id: 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.65,
      similarity_boost: 0.75,
      use_speaker_boost: true
    },
    output_format: 'mp3_44100_128'
  }
};
```

### **Supabase Edge Function for TTS**
```typescript
// supabase/functions/generate-speech/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface TTSRequest {
  text: string;
  voice_id?: string;
  cache_key?: string;
  settings?: {
    stability?: number;
    similarity_boost?: number;
  };
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voice_id = 'EXAVITQu4vr4xnSDxMaL', cache_key, settings } = await req.json() as TTSRequest;

    // Check cache first
    if (cache_key) {
      const cachedAudio = await getCachedAudio(cache_key);
      if (cachedAudio) {
        return new Response(cachedAudio, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }

    // Generate speech with ElevenLabs
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: settings?.stability ?? 0.75,
            similarity_boost: settings?.similarity_boost ?? 0.85,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!elevenLabsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    
    // Cache the result
    if (cache_key) {
      await cacheAudio(cache_key, audioBuffer);
    }

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('TTS Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate speech' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Cache management functions
async function getCachedAudio(cacheKey: string): Promise<ArrayBuffer | null> {
  // Implementation depends on chosen cache (Redis, Supabase Storage, etc.)
  // For MVP, we can use Supabase Storage as cache
  try {
    const { data, error } = await supabase.storage
      .from('audio-cache')
      .download(`${cacheKey}.mp3`);
    
    if (error) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

async function cacheAudio(cacheKey: string, audioBuffer: ArrayBuffer): Promise<void> {
  try {
    await supabase.storage
      .from('audio-cache')
      .upload(`${cacheKey}.mp3`, audioBuffer, {
        cacheControl: '3600',
        upsert: true
      });
  } catch (error) {
    console.error('Cache error:', error);
  }
}
```

### **Audio Management Service**
```typescript
// lib/audio-service.ts
class AudioService {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  async generateQuestionAudio(questionText: string, voiceId?: string): Promise<string> {
    const cacheKey = this.getCacheKey(questionText, voiceId);
    
    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: questionText,
          voice_id: voiceId,
          cache_key: cacheKey
        })
      });

      if (!response.ok) throw new Error('TTS generation failed');

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Audio generation error:', error);
      // Fallback to browser TTS
      return this.fallbackTTS(questionText);
    }
  }

  async playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.onended = () => resolve();
      this.currentAudio.onerror = () => reject(new Error('Audio playback failed'));
      this.currentAudio.play().catch(reject);
    });
  }

  stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  async startRecording(): Promise<MediaRecorder> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        resolve(audioBlob);
      };
      mediaRecorder.start();
      resolve(mediaRecorder);
    });
  }

  private getCacheKey(text: string, voiceId: string = 'default'): string {
    // Create a hash of the text and voice for caching
    return `${voiceId}_${btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
  }

  private fallbackTTS(text: string): string {
    // Browser-based TTS fallback
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
    return ''; // No URL for browser TTS
  }
}

export const audioService = new AudioService();
```

---

## 💳 Stripe Integration

### **Product Configuration**
```typescript
// Stripe Products and Prices
const STRIPE_PRODUCTS = {
  free: {
    id: 'prod_free',
    name: 'Free Plan',
    features: ['2 interviews/month', 'Basic feedback', 'Email support']
  },
  pro: {
    id: 'prod_pro',
    name: 'Professional Plan',
    price_id: 'price_pro_monthly',
    amount: 2900, // $29.00
    interval: 'month',
    features: [
      'Unlimited interviews',
      'AI-powered feedback',
      'Industry-specific questions',
      'Progress tracking',
      'Priority support'
    ]
  }
} as const;

// Usage limits by plan
const PLAN_LIMITS = {
  free: {
    interviews_per_month: 2,
    advanced_feedback: false,
    industry_questions: false,
    priority_support: false
  },
  pro: {
    interviews_per_month: -1, // unlimited
    advanced_feedback: true,
    industry_questions: true,
    priority_support: true
  }
} as const;
```

### **Stripe Webhook Handler**
```typescript
// supabase/functions/stripe-webhooks/index.ts
import Stripe from 'https://esm.sh/stripe@12.18.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-08-16'
});

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return new Response('Webhook Error', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response('Success', { status: 200 });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response('Webhook Error', { status: 500 });
  }

  async function handleSubscriptionChange(subscription: Stripe.Subscription) {
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        status: subscription.status,
        plan_type: subscription.items.data[0]?.price.lookup_key || 'pro',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) throw error;
  }
});
```

### **Payment Flow Components**
```typescript
// components/SubscriptionManager.tsx
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface SubscriptionManagerProps {
  currentPlan: 'free' | 'pro';
  userId: string;
}

export function SubscriptionManager({ currentPlan, userId }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    
    try {
      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: 'price_pro_monthly',
          user_id: userId
        })
      });

      const { sessionId } = await response.json();
      
      // Redirect to checkout
      const stripe = await stripePromise;
      await stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    setLoading(true);
    
    try {
      await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      
      // Refresh the page or update state
      window.location.reload();
    } catch (error) {
      console.error('Cancellation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Subscription Management</h3>
      
      {currentPlan === 'free' ? (
        <div>
          <p className="text-gray-600 mb-4">
            Upgrade to Pro for unlimited interviews and advanced features
          </p>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Upgrade to Pro ($29/month)'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-green-600 mb-4">
            ✅ You're on the Pro plan
          </p>
          <button
            onClick={handleCancelSubscription}
            disabled={loading}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Cancel Subscription'}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 Performance Optimization

### **Caching Strategy**
```typescript
// lib/cache-service.ts
class CacheService {
  private static readonly CACHE_KEYS = {
    USER_PROFILE: (userId: string) => `profile:${userId}`,
    USER_SUBSCRIPTION: (userId: string) => `subscription:${userId}`,
    QUESTIONS: (industry: string, difficulty: number) => `questions:${industry}:${difficulty}`,
    AUDIO: (textHash: string, voiceId: string) => `audio:${voiceId}:${textHash}`
  } as const;

  // In-memory cache for frequently accessed data
  private memoryCache = new Map<string, { data: any; expires: number }>();

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Check Supabase storage cache
    try {
      const { data } = await supabase.storage
        .from('cache')
        .download(`${key}.json`);
      
      if (data) {
        const json = await data.text();
        const parsed = JSON.parse(json);
        
        // Store in memory cache
        this.memoryCache.set(key, {
          data: parsed.data,
          expires: Date.now() + (parsed.ttl * 1000)
        });
        
        return parsed.data;
      }
    } catch {
      // Cache miss
    }

    return null;
  }

  async set<T>(key: string, data: T, ttlSeconds: number = 3600): Promise<void> {
    const cacheObject = {
      data,
      ttl: ttlSeconds,
      cached_at: new Date().toISOString()
    };

    // Store in memory
    this.memoryCache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    });

    // Store in Supabase storage
    try {
      await supabase.storage
        .from('cache')
        .upload(`${key}.json`, JSON.stringify(cacheObject), {
          cacheControl: ttlSeconds.toString(),
          upsert: true
        });
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  invalidate(key: string): void {
    this.memoryCache.delete(key);
    // Also delete from storage cache
    supabase.storage.from('cache').remove([`${key}.json`]);
  }
}

export const cacheService = new CacheService();
```

### **Question Selection Optimization**
```typescript
// lib/question-service.ts
class QuestionService {
  async getInterviewQuestions(
    industry: string,
    difficulty: number,
    count: number,
    userId: string
  ): Promise<Question[]> {
    const cacheKey = cacheService.CACHE_KEYS.QUESTIONS(industry, difficulty);
    
    // Try cache first
    let availableQuestions = await cacheService.get<Question[]>(cacheKey);
    
    if (!availableQuestions) {
      // Fetch from database
      const { data, error } = await supabase.rpc('get_interview_questions', {
        p_industry: industry,
        p_difficulty: difficulty,
        p_count: count * 3, // Get extra questions for variety
        p_user_id: userId
      });

      if (error) throw error;
      
      availableQuestions = data;
      
      // Cache for 1 hour
      await cacheService.set(cacheKey, availableQuestions, 3600);
    }

    // Filter out recently used questions for this user
    const recentQuestions = await this.getRecentQuestions(userId);
    const filteredQuestions = availableQuestions.filter(
      q => !recentQuestions.includes(q.id)
    );

    // Randomly select requested count
    return this.shuffleArray(filteredQuestions).slice(0, count);
  }

  private async getRecentQuestions(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from('interview_sessions')
      .select('questions')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    const recentQuestions: string[] = [];
    data?.forEach(session => {
      if (session.questions) {
        recentQuestions.push(...JSON.parse(session.questions));
      }
    });

    return [...new Set(recentQuestions)]; // Remove duplicates
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const questionService = new QuestionService();
```

---

## 📊 Analytics & Monitoring

### **Custom Analytics Service**
```typescript
// lib/analytics-service.ts
interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  session_id?: string;
  properties: Record<string, any>;
  timestamp?: string;
}

class AnalyticsService {
  async track(event: AnalyticsEvent): Promise<void> {
    const enrichedEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      user_agent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer
    };

    // Store in Supabase
    try {
      await supabase.from('analytics_events').insert(enrichedEvent);
    } catch (error) {
      console.error('Analytics error:', error);
    }

    // Also send to external analytics (if needed)
    if (typeof gtag !== 'undefined') {
      gtag('event', event.event_type, event.properties);
    }
  }

  // Convenience methods for common events
  async trackInterviewStarted(sessionId: string, industry: string, userId?: string): Promise<void> {
    await this.track({
      event_type: 'interview_started',
      user_id: userId,
      session_id: sessionId,
      properties: { industry }
    });
  }

  async trackInterviewCompleted(
    sessionId: string,
    duration: number,
    score: number,
    userId?: string
  ): Promise<void> {
    await this.track({
      event_type: 'interview_completed',
      user_id: userId,
      session_id: sessionId,
      properties: { duration, score }
    });
  }

  async trackSubscriptionUpgrade(userId: string, fromPlan: string, toPlan: string): Promise<void> {
    await this.track({
      event_type: 'subscription_upgraded',
      user_id: userId,
      properties: { from_plan: fromPlan, to_plan: toPlan }
    });
  }

  async trackAudioGeneration(questionId: string, generationTime: number): Promise<void> {
    await this.track({
      event_type: 'audio_generated',
      properties: { question_id: questionId, generation_time_ms: generationTime }
    });
  }
}

export const analytics = new AnalyticsService();
```

### **Performance Monitoring**
```typescript
// lib/performance-monitor.ts
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startTimer(label: string): () => void {
    const start = performance.now();
    return () => this.endTimer(label, start);
  }

  endTimer(label: string, startTime: number): void {
    const duration = performance.now() - startTime;
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    this.metrics.get(label)!.push(duration);
    
    // Report if this is a performance concern
    if (duration > 2000) { // > 2 seconds
      this.reportSlowOperation(label, duration);
    }
  }

  async reportMetrics(): Promise<void> {
    const report: Record<string, any> = {};
    
    for (const [label, times] of this.metrics) {
      report[label] = {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        p95: this.percentile(times, 95)
      };
    }

    await analytics.track({
      event_type: 'performance_report',
      properties: report
    });

    // Clear metrics after reporting
    this.metrics.clear();
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private async reportSlowOperation(operation: string, duration: number): Promise<void> {
    await analytics.track({
      event_type: 'slow_operation',
      properties: { operation, duration_ms: duration }
    });
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Auto-report metrics every 5 minutes
setInterval(() => {
  performanceMonitor.reportMetrics();
}, 5 * 60 * 1000);
```

---

## 🔒 Security Considerations

### **Environment Variables**
```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

ELEVENLABS_API_KEY=your_elevenlabs_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Optional
OPENAI_API_KEY=your_openai_key # For future features
```

### **RLS Policies Review**
```sql
-- Ensure all tables have proper RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- Review all policies
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public';
```

### **API Security Middleware**
```typescript
// lib/auth-middleware.ts
export async function requireAuth(req: NextRequest): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('No authorization token provided');
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid authorization token');
  }

  return user;
}

export async function requireSubscription(userId: string, requiredPlan: 'pro' | 'enterprise' = 'pro'): Promise<boolean> {
  const { data } = await supabase.rpc('get_user_subscription_status', { user_uuid: userId });
  
  if (!data || data.length === 0) {
    return false; // No subscription
  }

  const subscription = data[0];
  
  if (!subscription.is_active) {
    return false; // Inactive subscription
  }

  if (requiredPlan === 'pro' && subscription.plan_type === 'free') {
    return false; // Insufficient plan
  }

  return true;
}
```

---

**Next Steps**: Use this technical specification to guide the detailed implementation of each MVP component. Each section provides the exact code, configurations, and database schemas needed for a production-ready MVP.