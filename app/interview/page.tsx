'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Camera, CameraOff, Mic, MicOff, RotateCcw, Settings } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

interface InterviewState {
  isActive: boolean;
  currentQuestion: number;
  timeRemaining: number;
  isRecording: boolean;
  cameraEnabled: boolean;
  micEnabled: boolean;
}

interface MediaDevices {
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoDevice: string;
  selectedAudioDevice: string;
}

const sampleQuestions = {
  'Software Engineer': [
    "Tell me about yourself and your experience in software development.",
    "Describe a challenging technical problem you've solved recently.",
    "How do you approach debugging complex issues?",
    "What's your experience with agile development methodologies?"
  ],
  'Product Manager': [
    "How do you prioritize features in a product roadmap?",
    "Describe a time when you had to make a difficult product decision.",
    "How do you gather and analyze user feedback?",
    "Tell me about a successful product launch you've managed."
  ],
  'Data Scientist': [
    "Explain a machine learning project you've worked on.",
    "How do you handle missing data in your datasets?",
    "Describe your approach to model validation.",
    "What's your experience with A/B testing?"
  ],
  default: [
    "Tell me about yourself and your professional background.",
    "What interests you most about this position?",
    "Describe a challenge you've overcome in your career.",
    "Where do you see yourself in five years?"
  ]
};

export default function InterviewPage() {
  const searchParams = useSearchParams();
  const position = searchParams.get('position') || 'General';
  const duration = parseInt(searchParams.get('duration') || '3');
  const name = searchParams.get('name') || 'Candidate';

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [interviewState, setInterviewState] = useState<InterviewState>({
    isActive: false,
    currentQuestion: 0,
    timeRemaining: duration * 60,
    isRecording: false,
    cameraEnabled: true,
    micEnabled: true
  });

  const [mediaDevices, setMediaDevices] = useState<MediaDevices>({
    videoDevices: [],
    audioDevices: [],
    selectedVideoDevice: '',
    selectedAudioDevice: ''
  });

  const [showPreInterview, setShowPreInterview] = useState(true);
  const [mediaError, setMediaError] = useState<string>('');
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  const questions = sampleQuestions[position as keyof typeof sampleQuestions] || sampleQuestions.default;

  // Get available media devices
  useEffect(() => {
    const getMediaDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        setMediaDevices({
          videoDevices,
          audioDevices,
          selectedVideoDevice: videoDevices[0]?.deviceId || '',
          selectedAudioDevice: audioDevices[0]?.deviceId || ''
        });
      } catch (error) {
        console.error('Error getting media devices:', error);
        setMediaError('Unable to access media devices');
      }
    };

    getMediaDevices();
  }, []);

  // Initialize media stream
  useEffect(() => {
    if (showPreInterview) {
      initializeMediaStream();
    }

    return () => {
      stopMediaStream();
    };
  }, [interviewState.cameraEnabled, interviewState.micEnabled, mediaDevices.selectedVideoDevice, mediaDevices.selectedAudioDevice]);

  const initializeMediaStream = async () => {
    try {
      setIsLoadingMedia(true);
      setMediaError('');

      // Stop existing stream
      stopMediaStream();

      const constraints: MediaStreamConstraints = {
        video: interviewState.cameraEnabled ? {
          deviceId: mediaDevices.selectedVideoDevice ? { exact: mediaDevices.selectedVideoDevice } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: interviewState.micEnabled ? {
          deviceId: mediaDevices.selectedAudioDevice ? { exact: mediaDevices.selectedAudioDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current && interviewState.cameraEnabled) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      let errorMessage = 'Unable to access camera or microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera and microphone access denied. Please allow permissions and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.';
      }
      
      setMediaError(errorMessage);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = async () => {
    setInterviewState(prev => ({ ...prev, cameraEnabled: !prev.cameraEnabled }));
  };

  const toggleMic = async () => {
    setInterviewState(prev => ({ ...prev, micEnabled: !prev.micEnabled }));
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      setMediaError('No media stream available for recording');
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Handle recorded data here
          console.log('Recording data available:', event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
      };

      mediaRecorder.start();
      setInterviewState(prev => ({ ...prev, isRecording: true }));
    } catch (error) {
      console.error('Error starting recording:', error);
      setMediaError('Unable to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setInterviewState(prev => ({ ...prev, isRecording: false }));
    }
  };

  const startInterview = async () => {
    setShowPreInterview(false);
    setInterviewState(prev => ({ ...prev, isActive: true }));
    await startRecording();
  };

  const nextQuestion = () => {
    if (interviewState.currentQuestion < questions.length - 1) {
      setInterviewState(prev => ({ ...prev, currentQuestion: prev.currentQuestion + 1 }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (interviewState.isActive && interviewState.timeRemaining > 0) {
      interval = setInterval(() => {
        setInterviewState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1
        }));
      }, 1000);
    } else if (interviewState.timeRemaining === 0) {
      setInterviewState(prev => ({ ...prev, isActive: false }));
      stopRecording();
    }

    return () => clearInterval(interval);
  }, [interviewState.isActive, interviewState.timeRemaining]);

  if (showPreInterview) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <Link href="/form" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              Back to Form
            </Link>
            <div className="text-2xl font-bold gradient-text">InterviewAI</div>
          </motion.div>

          {/* Pre-Interview Setup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl p-8 md:p-12"
          >
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Ready for Your Interview?</h1>
              <p className="text-xl text-gray-600">
                Hi {name}! Let's prepare for your {position} interview
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Camera Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Camera Preview</h3>
                <div className="aspect-video bg-gray-900 rounded-xl relative overflow-hidden">
                  {isLoadingMedia ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p>Loading camera...</p>
                      </div>
                    </div>
                  ) : mediaError ? (
                    <div className="w-full h-full bg-red-900 flex items-center justify-center p-4">
                      <div className="text-red-100 text-center">
                        <CameraOff className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">{mediaError}</p>
                        <button 
                          onClick={initializeMediaStream}
                          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : interviewState.cameraEnabled ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <div className="text-gray-400 text-center">
                        <CameraOff className="w-12 h-12 mx-auto mb-2" />
                        <p>Camera Disabled</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-colors ${
                      interviewState.cameraEnabled 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {interviewState.cameraEnabled ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-colors ${
                      interviewState.micEnabled 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {interviewState.micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                </div>

                {/* Device Selection */}
                {(mediaDevices.videoDevices.length > 1 || mediaDevices.audioDevices.length > 1) && (
                  <div className="space-y-3">
                    {mediaDevices.videoDevices.length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
                        <select
                          value={mediaDevices.selectedVideoDevice}
                          onChange={(e) => setMediaDevices(prev => ({ ...prev, selectedVideoDevice: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          {mediaDevices.videoDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {mediaDevices.audioDevices.length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Microphone</label>
                        <select
                          value={mediaDevices.selectedAudioDevice}
                          onChange={(e) => setMediaDevices(prev => ({ ...prev, selectedAudioDevice: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          {mediaDevices.audioDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Interview Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Interview Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Position:</span>
                      <span className="font-medium">{position}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">{duration} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Questions:</span>
                      <span className="font-medium">{questions.length} questions</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-blue-800 mb-2">Tips for Success:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Speak clearly and maintain eye contact with the camera</li>
                    <li>• Take a moment to think before answering</li>
                    <li>• Use specific examples in your responses</li>
                    <li>• Stay calm and confident</li>
                    <li>• Ensure good lighting and minimal background noise</li>
                  </ul>
                </div>

                <div className="p-4 bg-yellow-50 rounded-xl">
                  <h4 className="font-semibold text-yellow-800 mb-2">Technical Requirements:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Camera and microphone permissions required</li>
                    <li>• Stable internet connection recommended</li>
                    <li>• Chrome, Firefox, or Safari browser</li>
                    <li>• Close other applications for best performance</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={startInterview}
                disabled={!!mediaError || isLoadingMedia}
                className={`text-xl px-12 py-4 rounded-xl font-semibold transition-all duration-300 ${
                  mediaError || isLoadingMedia
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                }`}
              >
                {isLoadingMedia ? 'Setting up...' : 'Start Interview'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Interview Header */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-xl font-bold gradient-text">InterviewAI</div>
              <div className="text-gray-600">|</div>
              <div className="text-gray-700">{position} Interview</div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-lg font-semibold text-gray-700">
                {formatTime(interviewState.timeRemaining)}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${interviewState.isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm text-gray-600">
                  {interviewState.isRecording ? 'Recording' : 'Stopped'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interview Interface */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
          {/* AI Interviewer Video */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">AI Interviewer</h2>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="flex-1 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl relative overflow-hidden">
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="w-16 h-16 bg-white/30 rounded-full animate-pulse"></div>
                  </div>
                  <p className="text-lg font-medium">AI Interviewer Active</p>
                  <p className="text-sm opacity-75">Listening to your response</p>
                </div>
              </div>
            </div>

            {/* Current Question */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Question {interviewState.currentQuestion + 1} of {questions.length}</span>
                <button
                  onClick={nextQuestion}
                  disabled={interviewState.currentQuestion >= questions.length - 1}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  Next Question
                </button>
              </div>
              <p className="text-lg font-medium text-gray-800">
                {questions[interviewState.currentQuestion]}
              </p>
            </div>
          </motion.div>

          {/* User Video & Controls */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Response</h2>
              <div className="flex gap-2">
                <button
                  onClick={toggleCamera}
                  className={`p-2 rounded-lg transition-colors ${
                    interviewState.cameraEnabled 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {interviewState.cameraEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-lg transition-colors ${
                    interviewState.micEnabled 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {interviewState.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-900 rounded-xl relative overflow-hidden">
              {interviewState.cameraEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <div className="text-gray-400 text-center">
                    <CameraOff className="w-16 h-16 mx-auto mb-4" />
                    <p>Camera is off</p>
                  </div>
                </div>
              )}
            </div>

            {/* Response Timer & Controls */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Response Time</span>
                <span className="text-lg font-mono">0:45</span>
              </div>
              
              <div className="flex gap-4">
                <button className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors">
                  I'm Ready
                </button>
                <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="bg-white rounded-full p-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((duration * 60 - interviewState.timeRemaining) / (duration * 60)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}