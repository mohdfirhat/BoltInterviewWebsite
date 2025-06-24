'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Briefcase, Clock, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const jobPositions = [
  'Software Engineer',
  'Product Manager',
  'Data Scientist',
  'UX/UI Designer',
  'Marketing Manager',
  'Sales Representative',
  'Business Analyst',
  'Project Manager',
  'DevOps Engineer',
  'Customer Success Manager',
  'Other'
];

const interviewDurations = [
  { value: 1, label: '1 Minute', description: 'Quick practice session' },
  { value: 3, label: '3 Minutes', description: 'Standard practice' },
  { value: 5, label: '5 Minutes', description: 'Comprehensive session' }
];

export default function FormPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    jobPosition: '',
    customPosition: '',
    duration: 3,
    name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    const finalJobPosition = formData.jobPosition === 'Other' ? formData.customPosition : formData.jobPosition;
    
    // Navigate to interview page with form data
    const params = new URLSearchParams({
      position: finalJobPosition,
      duration: formData.duration.toString(),
      name: formData.name
    });
    
    router.push(`/interview?${params.toString()}`);
  };

  const isFormValid = formData.name.trim() && 
    (formData.jobPosition !== 'Other' ? formData.jobPosition : formData.customPosition.trim());

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-6 max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
          <div className="text-2xl font-bold gradient-text">InterviewAI</div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-3xl shadow-xl p-8 md:p-12"
        >
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-4">Set Up Your Interview</h1>
            <p className="text-xl text-gray-600">
              Tell us about the position you're preparing for and we'll customize your practice session
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Name Field */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="flex items-center gap-3 text-lg font-semibold text-gray-700 mb-4">
                <User className="w-6 h-6 text-blue-500" />
                Your Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none transition-colors"
                required
              />
            </motion.div>

            {/* Job Position */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="flex items-center gap-3 text-lg font-semibold text-gray-700 mb-4">
                <Briefcase className="w-6 h-6 text-blue-500" />
                Job Position
              </label>
              <select
                value={formData.jobPosition}
                onChange={(e) => setFormData({ ...formData, jobPosition: e.target.value })}
                className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none transition-colors"
                required
              >
                <option value="">Select a position</option>
                {jobPositions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>

              {formData.jobPosition === 'Other' && (
                <motion.input
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  type="text"
                  value={formData.customPosition}
                  onChange={(e) => setFormData({ ...formData, customPosition: e.target.value })}
                  placeholder="Enter your specific job position"
                  className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none transition-colors mt-4"
                  required
                />
              )}
            </motion.div>

            {/* Interview Duration */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="flex items-center gap-3 text-lg font-semibold text-gray-700 mb-6">
                <Clock className="w-6 h-6 text-blue-500" />
                Interview Duration
              </label>
              <div className="grid md:grid-cols-3 gap-4">
                {interviewDurations.map((duration) => (
                  <motion.div
                    key={duration.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.duration === duration.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFormData({ ...formData, duration: duration.value })}
                  >
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-800 mb-2">
                        {duration.label}
                      </div>
                      <div className="text-sm text-gray-600">
                        {duration.description}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="pt-6"
            >
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`w-full py-4 px-8 rounded-xl text-lg font-semibold transition-all duration-300 flex items-center justify-center gap-3 ${
                  isFormValid && !isSubmitting
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Preparing Your Interview...
                  </>
                ) : (
                  <>
                    Start Interview
                    <ArrowRight className="w-6 h-6" />
                  </>
                )}
              </button>
            </motion.div>
          </form>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-6 bg-gray-50 rounded-xl"
          >
            <h3 className="font-semibold text-gray-800 mb-2">What to expect:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Personalized questions based on your selected position</li>
              <li>• Real-time AI interviewer interaction</li>
              <li>• Instant feedback on your responses</li>
              <li>• Tips for improvement after the session</li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}