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
  const interviewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const questions = sampleQuestions[position as keyof typeof sampleQuestions] || sampleQuestions.default;

  // Audio level monitoring
  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Start monitoring audio levels
      monitorAudioLevel();
    } catch (error) {
      console.error('Error setting up audio analyser:', error);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current || !interviewState.micEnabled) {
        setAudioLevel(0);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Normalize to 0-100 range
      const normalizedLevel = Math.min(100, (average / 128) * 100);
      setAudioLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  // Cleanup audio monitoring
  const cleanupAudioAnalyser = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Check permissions and get available media devices
  useEffect(() => {
    const initializeDevices = async () => {
      try {
        setIsLoadingMedia(true);
        setMediaError('');
        
        // First, request permissions to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        // Stop the temporary stream immediately
        tempStream.getTracks().forEach(track => track.stop());
        
        // Now enumerate devices with proper labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        setMediaDevices({
          videoDevices,
          audioDevices,
          selectedVideoDevice: videoDevices[0]?.deviceId || '',
          selectedAudioDevice: audioDevices[0]?.deviceId || ''
        });
        
        setPermissionsGranted(true);
        
      } catch (error) {
        console.error('Error getting media devices:', error);
        setMediaError('Please allow camera and microphone access to continue');
        setPermissionsGranted(false);
      } finally {
        setIsLoadingMedia(false);
      }
    };

    initializeDevices();
  }, []);

  // Initialize media stream when permissions are granted and devices are available
  useEffect(() => {
    if (permissionsGranted && mediaDevices.selectedVideoDevice && mediaDevices.selectedAudioDevice) {
      initializeMediaStream();
    }

    return () => {
      stopMediaStream();
      cleanupAudioAnalyser();
    };
  }, [permissionsGranted, mediaDevices.selectedVideoDevice, mediaDevices.selectedAudioDevice]);

  // Handle camera/mic toggle effects
  useEffect(() => {
    if (streamRef.current) {
      // Update existing stream tracks
      const videoTracks = streamRef.current.getVideoTracks();
      const audioTracks = streamRef.current.getAudioTracks();
      
      videoTracks.forEach(track => {
        track.enabled = interviewState.cameraEnabled;
      });
      
      audioTracks.forEach(track => {
        track.enabled = interviewState.micEnabled;
      });

      // Update video element visibility
      if (videoRef.current) {
        videoRef.current.style.display = interviewState.cameraEnabled ? 'block' : 'none';
      }
      if (interviewVideoRef.current) {
        interviewVideoRef.current.style.display = interviewState.cameraEnabled ? 'block' : 'none';
      }
    }
  }, [interviewState.cameraEnabled, interviewState.micEnabled]);

  const initializeMediaStream = async () => {
    if (!permissionsGranted) return;

    try {
      setIsLoadingMedia(true);
      setMediaError('');

      // Stop existing stream
      stopMediaStream();
      cleanupAudioAnalyser();

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: mediaDevices.selectedVideoDevice ? { exact: mediaDevices.selectedVideoDevice } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          deviceId: mediaDevices.selectedAudioDevice ? { exact: mediaDevices.selectedAudioDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      console.log('Requesting media with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      console.log('Media stream obtained:', stream);
      console.log('Audio tracks:', stream.getAudioTracks());
      console.log('Video tracks:', stream.getVideoTracks());

      // Set up video preview for both pre-interview and interview screens
      if (stream.getVideoTracks().length > 0) {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
        }
        
        if (interviewVideoRef.current) {
          interviewVideoRef.current.srcObject = stream;
          interviewVideoRef.current.onloadedmetadata = () => {
            interviewVideoRef.current?.play().catch(console.error);
          };
        }
      }

      // Set up audio level monitoring
      if (stream.getAudioTracks().length > 0) {
        setupAudioAnalyser(stream);
      }

      // Apply current camera/mic settings to the stream
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      videoTracks.forEach(track => {
        track.enabled = interviewState.cameraEnabled;
      });
      
      audioTracks.forEach(track => {
        track.enabled = interviewState.micEnabled;
      });

      // Test audio levels
      if (stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        console.log('Audio track settings:', audioTrack.getSettings());
        console.log('Audio track constraints:', audioTrack.getConstraints());
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
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Selected device does not support the required settings. Try a different device.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'Media access was aborted. Please try again.';
      }
      
      setMediaError(errorMessage);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log(`Stopping ${track.kind} track:`, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (interviewVideoRef.current) {
      interviewVideoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    setInterviewState(prev => ({ ...prev, cameraEnabled: !prev.cameraEnabled }));
  };

  const toggleMic = () => {
    setInterviewState(prev => ({ ...prev, micEnabled: !prev.micEnabled }));
  };

  const requestPermissions = async () => {
    try {
      setIsLoadingMedia(true);
      setMediaError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Stop the stream immediately, we just needed permissions
      stream.getTracks().forEach(track => track.stop());
      
      // Re-enumerate devices now that we have permissions
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      setMediaDevices({
        videoDevices,
        audioDevices,
        selectedVideoDevice: videoDevices[0]?.deviceId || '',
        selectedAudioDevice: audioDevices[0]?.deviceId || ''
      });
      
      setPermissionsGranted(true);
      
    } catch (error) {
      console.error('Permission request failed:', error);
      setMediaError('Permissions denied. Please allow camera and microphone access.');
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      setMediaError('No media stream available for recording');
      return;
    }

    try {
      // Check if we have both audio and video tracks
      const audioTracks = streamRef.current.getAudioTracks();
      const videoTracks = streamRef.current.getVideoTracks();
      
      console.log('Starting recording with tracks:', {
        audio: audioTracks.length,
        video: videoTracks.length
      });

      let mimeType = 'video/webm;codecs=vp9,opus';
      
      // Fallback mime types if the preferred one isn't supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Recording data available:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
      };

      mediaRecorder.onerror = (event) => {
        console.error('Recording error:', event);
        setMediaError('Recording failed. Please try again.');
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      setInterviewState(prev => ({ ...prev, isRecording: true }));
      
      console.log('Recording started with mime type:', mimeType);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setMediaError('Unable to start recording. Please check your browser compatibility.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setInterviewState(prev => ({ ...prev, isRecording: false }));
    }
  };

  const startInterview = async () => {
    if (!streamRef.current) {
      setMediaError('Please ensure camera and microphone are working before starting');
      return;
    }

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

  // Audio Level Indicator Component
  const AudioLevelIndicator = ({ level, enabled }: { level: number; enabled: boolean }) => {
    const bars = 10;
    const activeBars = Math.ceil((level / 100) * bars);
    
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: bars }, (_, i) => {
          const isActive = enabled && i < activeBars;
          let barColor = 'bg-gray-300';
          
          if (isActive) {
            if (level < 20) {
              barColor = 'bg-yellow-500';
            } else if (level <= 80) {
              barColor = 'bg-green-500';
            } else {
              barColor = 'bg-red-500';
            }
          }
          
          return (
            <div
              key={i}
              className={`w-1 h-4 rounded-full transition-all duration-100 ${barColor}`}
            />
          );
        })}
      </div>
    );
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
                <h3 className="text-lg font-semibold">Camera & Microphone Setup</h3>
                <div className="aspect-video bg-gray-900 rounded-xl relative overflow-hidden">
                  {!permissionsGranted ? (
                    <div className="w-full h-full bg-blue-900 flex items-center justify-center p-4">
                      <div className="text-blue-100 text-center">
                        <Camera className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">Camera & Microphone Access Required</p>
                        <p className="text-sm mb-4">Please allow access to your camera and microphone to continue</p>
                        <button 
                          onClick={requestPermissions}
                          disabled={isLoadingMedia}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isLoadingMedia ? 'Requesting Access...' : 'Allow Access'}
                        </button>
                      </div>
                    </div>
                  ) : isLoadingMedia ? (
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
                        <p className="text-sm mb-4">{mediaError}</p>
                        <button 
                          onClick={initializeMediaStream}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
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
                      style={{ transform: 'scaleX(-1)' }} // Mirror effect for natural preview
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
                    disabled={!permissionsGranted}
                    className={`p-3 rounded-full transition-colors disabled:opacity-50 ${
                      interviewState.cameraEnabled 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {interviewState.cameraEnabled ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={toggleMic}
                    disabled={!permissionsGranted}
                    className={`p-3 rounded-full transition-colors disabled:opacity-50 ${
                      interviewState.micEnabled 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {interviewState.micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                </div>

                {/* Audio Level Indicator */}
                {permissionsGranted && streamRef.current && (
                  <div className="bg-gray-100 p-4 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Mic className={`w-5 h-5 ${interviewState.micEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium">
                        {interviewState.micEnabled ? 'Microphone Active' : 'Microphone Disabled'}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Audio Level</span>
                        <span className="text-xs text-gray-600">{Math.round(audioLevel)}%</span>
                      </div>
                      <AudioLevelIndicator level={audioLevel} enabled={interviewState.micEnabled} />
                      <div className="text-xs text-gray-600">
                        {interviewState.micEnabled 
                          ? audioLevel > 5 
                            ? '✓ Microphone is working - speak to see levels'
                            : 'Speak to test your microphone'
                          : 'Enable microphone to test audio levels'
                        }
                      </div>
                    </div>
                  </div>
                )}

                {/* Device Selection */}
                {permissionsGranted && (mediaDevices.videoDevices.length > 1 || mediaDevices.audioDevices.length > 1) && (
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

                {/* System Check */}
                <div className="p-4 bg-green-50 rounded-xl">
                  <h4 className="font-semibold text-green-800 mb-2">System Check:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${permissionsGranted ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={permissionsGranted ? 'text-green-700' : 'text-red-700'}>
                        Camera & Microphone Access
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${streamRef.current ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className={streamRef.current ? 'text-green-700' : 'text-yellow-700'}>
                        Media Stream Active
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${audioLevel > 5 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className={audioLevel > 5 ? 'text-green-700' : 'text-yellow-700'}>
                        Microphone Audio Detected
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={startInterview}
                disabled={!permissionsGranted || !!mediaError || isLoadingMedia || !streamRef.current}
                className={`text-xl px-12 py-4 rounded-xl font-semibold transition-all duration-300 ${
                  !permissionsGranted || mediaError || isLoadingMedia || !streamRef.current
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                }`}
              >
                {isLoadingMedia ? 'Setting up...' : !permissionsGranted ? 'Allow Access First' : 'Start Interview'}
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
                      ? 'bg-green-500 text-white' 
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
                  ref={interviewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }} // Mirror effect for natural preview
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

            {/* Audio Level Indicator in Interview */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mic className={`w-4 h-4 ${interviewState.micEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">Audio Level</span>
                </div>
                <span className="text-xs text-gray-600">{Math.round(audioLevel)}%</span>
              </div>
              <AudioLevelIndicator level={audioLevel} enabled={interviewState.micEnabled} />
            </div>

            {/* Response Timer & Controls */}
            <div className="mt-4 space-y-4">
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