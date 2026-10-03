"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResultEvent = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function appendSpeechTranscript(current: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return current;
  return `${current}${current.trim() ? " " : ""}${spoken}`;
}

/** A deliberately bounded browser-only dictation seam: one utterance, no upload, no persistence. */
export function useSpeechInput(onTranscript: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onTranscript);
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setAvailable(Boolean(Recognition));
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) callbackRef.current(transcript);
    };
    recognition.onerror = () => {
      setError("Voice input stopped. You can keep typing your capture.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    setError(undefined);
    setListening(true);
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("Voice input could not start. You can keep typing your capture.");
    }
  }, []);

  return { available, listening, error, start };
}
