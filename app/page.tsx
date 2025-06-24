'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Clock, Target, Users, Zap } from 'lucide-react';
import Link from 'next/link';

const benefits = [
  {
    icon: Target,
    title: 'Targeted Practice',
    description: 'Practice for specific job positions with customized interview questions'
  },
  {
    icon: Clock,
    title: 'Flexible Duration',
    description: 'Choose from 1, 3, or 5-minute sessions that fit your schedule'
  },
  {
    icon: Zap,
    title: 'AI-Powered Feedback',
    description: 'Get instant, personalized feedback to improve your performance'
  },
  {
    icon: Users,
    title: 'Realistic Experience',
    description: 'Interactive video interviews that simulate real hiring scenarios'
  }
];

const features = [
  'Practice anytime, anywhere',
  'Build confidence before real interviews',
  'Improve communication skills',
  'Get comfortable with video interviews',
  'Track your progress over time',
  'Prepare for various job roles'
];

export default function OnboardingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="container mx-auto px-6 py-8">
        <nav className="flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold gradient-text"
          >
            InterviewAI
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link href="/form" className="btn-secondary">
              Start Practice
            </Link>
          </motion.div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-6xl font-bold mb-6"
          >
            Master Your <span className="gradient-text">Interview Skills</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-600 mb-8 leading-relaxed"
          >
            Practice with AI-powered interactive interviews. Build confidence, 
            improve your responses, and land your dream job.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/form" className="btn-primary flex items-center gap-2">
              Start Your Practice <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="btn-secondary">
              Watch Demo
            </button>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">Why Choose InterviewAI?</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our platform combines cutting-edge AI technology with proven interview techniques
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg card-hover text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <benefit.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-4">{benefit.title}</h3>
              <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Everything You Need to <span className="gradient-text">Succeed</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Our comprehensive platform provides all the tools and practice you need 
                to excel in your next interview.
              </p>
              
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 text-lg">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl p-8 text-white">
                <div className="bg-white/20 rounded-2xl p-6 mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white/30 rounded-full animate-pulse-slow"></div>
                    <div>
                      <div className="h-4 bg-white/40 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-white/30 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-white/30 rounded"></div>
                    <div className="h-3 bg-white/30 rounded w-4/5"></div>
                    <div className="h-3 bg-white/30 rounded w-3/5"></div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">Live Interview Session</span>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400 rounded-full animate-float opacity-20"></div>
              <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-pink-400 rounded-full animate-float opacity-30" style={{ animationDelay: '2s' }}></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white"
        >
          <h2 className="text-4xl font-bold mb-6">Ready to Ace Your Next Interview?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of professionals who have improved their interview skills with our AI-powered platform.
          </p>
          <Link href="/form" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:shadow-lg hover:scale-105">
            Start Practicing Now <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="text-2xl font-bold gradient-text mb-4">InterviewAI</div>
          <p className="text-gray-400 mb-6">Empowering professionals to succeed in their career journey</p>
          <div className="flex justify-center gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}