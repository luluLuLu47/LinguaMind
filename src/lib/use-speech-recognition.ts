"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// 浏览器 Web Speech API 类型扩展
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

interface UseSpeechRecognitionOptions {
  lang: "en" | "ko";
  onResult?: (text: string) => void;
  continuous?: boolean;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * 浏览器原生 Web Speech API 语音识别 hook。
 *
 * 优势：
 * - 完全免费，不需要任何 API key
 * - 实时识别（边说边出字）
 * - 支持 Chrome / Edge / Safari
 * - 无需上传音频文件
 */
export function useSpeechRecognition({
  lang,
  onResult,
  continuous = false,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const shouldRestartRef = useRef(false);

  // 更新回调引用（避免重建 recognition）
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const isSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // 初始化 recognition 实例
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition!;
    const recognition = new SpeechRecognitionClass();

    // 语言映射：Web Speech API 用 BCP-47 标签
    recognition.lang = lang === "ko" ? "ko-KR" : "en-US";
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript((prev) => prev + finalText);
        setInterimTranscript("");
        // 通知回调
        if (onResultRef.current) {
          onResultRef.current(finalText.trim());
        }
      } else {
        setInterimTranscript(interimText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" 和 "aborted" 不算错误，静默处理
      if (event.error !== "no-speech" && event.error !== "aborted") {
        if (event.error === "not-allowed") {
          setError("麦克风权限被拒绝，请在浏览器设置中允许访问麦克风");
        } else if (event.error === "network") {
          setError("语音识别服务网络错误，请检查网络连接");
        } else {
          setError(`语音识别错误: ${event.error}`);
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");

      // 如果是连续模式且需要重启（某些浏览器会自动停止）
      if (shouldRestartRef.current && continuous) {
        try {
          recognition.start();
        } catch {
          // 忽略重复启动错误
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, continuous, isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    shouldRestartRef.current = continuous;
    try {
      recognitionRef.current.start();
    } catch {
      // 忽略重复启动错误
    }
  }, [continuous]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    isSupported: !!isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
