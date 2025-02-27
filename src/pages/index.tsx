import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router'; // Added for error handling

const SpeechToTextConverter = () => {
  const router = useRouter(); // Added for error handling
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false); // Initialize as false
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState(''); // Added for error handling
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if the browser supports the Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition); // More concise check

    if (isSupported) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(prev => prev + finalTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError('Speech recognition error. Please try again.');
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        if (isRecording) {
          recognitionRef.current.start();
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording, isSupported]);


  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current.stop();
    } else if (isSupported) {
      setTranscript('');
      recognitionRef.current.start();
    } else {
      setError('Your browser does not support speech recognition.');
    }
    setIsRecording(!isRecording);
  };

  const copyToClipboard = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript).catch(err => {
        setError("Failed to copy to clipboard.");
        console.error("Clipboard write failed:", err);
      });
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  //Improved Error Handling and UI for unsupported browsers
  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center text-red-600 mb-4">Browser Not Supported</h1>
          <p className="text-gray-700 text-center">
            Your browser does not support the Web Speech API. Please try using Chrome, Edge, or Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100"> {/*Light Gray Background*/}
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md"> {/*White Card*/}
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Speech to Text Converter</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error:</strong> <span className="block sm:inline">{error}</span>
          </div>
        )}
        <div className="mb-6">
          <button
            onClick={toggleRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center focus:outline-none transition-all duration-300 ${
              isRecording ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {/*Simplified Icons using Material Icons for better iOS look*/}
            <span className={`${isRecording ? 'text-white' : 'text-white'}`}>
              {isRecording ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.657z" /></svg>}
            </span>
          </button>
        </div>

        <div className="mb-4">
          <textarea
            className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-base"
            placeholder="Your speech will appear here..."
            value={transcript}
            readOnly
          ></textarea>
          {transcript && (
            <div className="flex justify-end mt-2 space-x-2">
              <button
                onClick={copyToClipboard}
                className="p-2 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none"
                title="Copy to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-2m-4-2v4m8-4h.01M18 10a3 3 0 100-6 3 3 0 000 6z" /></svg>
              </button>
              <button
                onClick={clearTranscript}
                className="p-2 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none"
                title="Clear text"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>

        {isCopied && (
          <div className="text-center text-green-600 mb-4">Copied to clipboard!</div>
        )}

        <p className="text-center text-sm text-gray-500">Speak clearly into your microphone.</p>
      </div>
    </div>
  );
};

export default SpeechToTextConverter;
