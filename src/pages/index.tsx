import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

interface DeviceInfo {
  deviceId: string;
  label: string;
}

const SpeechToTextConverter = () => {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);

  const enumerateMicrophones = async () => {
    try {
      // First get permission by requesting an audio stream
      const initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the initial stream right away - we just needed it for permissions
      initialStream.getTracks().forEach(track => track.stop());

      // Now enumerate devices - this should show labels since we have permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices: DeviceInfo[] = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
        }));

      setMicrophones(audioInputDevices);
      
      // Select the first device by default if we don't have one selected
      if (audioInputDevices.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(audioInputDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error accessing microphones:', err);
      setError('Please grant microphone permission to use this app.');
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeRecognition = () => {
    if (recognitionRef.current) return; // Prevent multiple initializations

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      setTranscript((prev) => prev + finalTranscript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setError('Speech recognition error. Please try again.');
        setIsRecording(false);
        setIsRecognitionActive(false);
      }
    };

    recognitionRef.current.onstart = () => {
      setIsRecognitionActive(true);
    };

    recognitionRef.current.onend = () => {
      setIsRecognitionActive(false);
    };
  };

  const stopRecognition = async () => {
    try {
      if (recognitionRef.current) {
        // Remove all event listeners first
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        
        // Stop recognition and wait a bit
        recognitionRef.current.stop();
        await new Promise(resolve => setTimeout(resolve, 100));
        recognitionRef.current = null;
        setIsRecognitionActive(false);
      }
    } catch (e) {
      console.log('Recognition was not active');
    }
  };

  const startRecognition = async () => {
    if (isRecognitionActive) return;

    try {
      if (!recognitionRef.current) {
        initializeRecognition();
      }

      // Add a small delay before starting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (recognitionRef.current && !isRecognitionActive) {
        recognitionRef.current.start();
      }
    } catch (e) {
      console.error('Error starting recognition:', e);
      setError('Error starting speech recognition');
      setIsRecording(false);
      setIsRecognitionActive(false);
    }
  };

  useEffect(() => {
    const savedMicrophoneId = localStorage.getItem('selectedMicrophone');
    if (savedMicrophoneId) {
      setSelectedMicrophone(savedMicrophoneId);
    }

    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const isBrowserSupported = !!SpeechRecognition;
      setIsSupported(isBrowserSupported);

      if (isBrowserSupported) {
        initializeRecognition();

        enumerateMicrophones();
        navigator.mediaDevices.addEventListener('devicechange', enumerateMicrophones);
        
        return () => {
          stopRecognition();
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
        };
      }
    }
  }, []);

  const setupAudioStream = async () => {
    if (!isSupported || !selectedMicrophone || !isRecording) return;

    try {
      // Cleanup existing resources
      await stopRecognition();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Get new stream with selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedMicrophone },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Initialize new recognition instance
      initializeRecognition();

      // Ensure proper delay before starting
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (isRecording && !isRecognitionActive) {
        await startRecognition();
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing selected microphone.');
      setIsRecording(false);
      setIsRecognitionActive(false);
    }
  };

  useEffect(() => {
    if (isRecording && selectedMicrophone) {
      setupAudioStream();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      stopRecognition();
    }
  }, [isRecording, selectedMicrophone]);

  const toggleRecording = async () => {
    if (!isSupported) {
      setError('Your browser does not support speech recognition.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      setIsRecognitionActive(false);
      await stopRecognition();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    } else {
      setError('');
      setTranscript('');
      setIsRecording(true);
    }
  };

  const copyToClipboard = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript).catch((err) => {
        setError('Failed to copy to clipboard.');
        console.error('Clipboard write failed:', err);
      });
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  const handleMicrophoneChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newMicrophoneId = event.target.value;
    const wasRecording = isRecording;
    
    // Stop current recording and cleanup
    if (isRecording) {
      stopRecognition();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
    }

    // Update microphone selection
    setSelectedMicrophone(newMicrophoneId);
    localStorage.setItem('selectedMicrophone', newMicrophoneId);

    // Ensure microphone change is processed before restarting
    await new Promise(resolve => setTimeout(resolve, 100));

    // Restart recording if it was active
    if (wasRecording) {
      setIsRecording(true);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center text-red-600 mb-4">
            Browser Not Supported
          </h1>
          <p className="text-gray-700 text-center">
            Your browser does not support the Web Speech API. Please try using
            Chrome, Edge, or Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-lg">
        <h1 className="text-2xl font-semibold text-center text-gray-800 mb-6">
          Voice to Text
        </h1>
        
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {isInitializing ? (
          <div className="mb-4 flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            <p className="text-gray-600">Initializing...</p>
          </div>
        ) : microphones.length > 0 ? (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="microphone-select" className="text-sm font-medium text-gray-600">
                Input Device
              </label>
              <button
                onClick={enumerateMicrophones}
                className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
              >
                Refresh
              </button>
            </div>
            <select
              id="microphone-select"
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              value={selectedMicrophone || ''}
              onChange={handleMicrophoneChange}
            >
              {microphones.map((microphone) => (
                <option key={microphone.deviceId} value={microphone.deviceId}>
                  {microphone.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-6 text-center">
            <p className="text-gray-600 mb-2">No microphones found</p>
            <button
              onClick={enumerateMicrophones}
              className="px-4 py-2 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
            >
              Check Again
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-col items-center">
          <button
            onClick={toggleRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 shadow-lg scale-110' 
                : 'bg-blue-500 hover:bg-blue-600 shadow'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              <div className="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-white mt-1">Stop</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-white mt-1">Record</span>
              </div>
            )}
          </button>
          
          <p className="mt-4 text-sm text-gray-500">
            {isRecording ? 'Listening...' : 'Tap to start'}
          </p>
        </div>

        <div className="mb-4">
          <textarea
            className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none text-base bg-gray-50"
            placeholder="Your words will appear here..."
            value={transcript}
            readOnly
          ></textarea>
          
          {transcript && (
            <div className="flex justify-end mt-2 space-x-2">
              <button
                onClick={copyToClipboard}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                title="Copy to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
              <button
                onClick={clearTranscript}
                className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                title="Clear text"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {isCopied && (
          <div className="text-center text-sm text-green-500 mb-4">
            Copied ✓
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeechToTextConverter;
