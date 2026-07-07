// NotificationContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/authFetch";

interface Notification {
  id: string;
  videoName: string;
  success: boolean;
  data?: any;
  read: boolean;
  timestamp: number;

  processing?: boolean;
  videoId?: number;
  processingStage?: string;
  progress?: number;
}

type ToastSeverity = "success" | "info" | "warning" | "error";

interface ToastState {
  open: boolean;
  message: string;
  severity: ToastSeverity;
}

interface NotificationContextType {
  hydrated: boolean;

  notifications: Notification[];
  addNotification: (videoName: string, success: boolean, data?: any) => void;

  addProcessingNotification: (videoName: string, videoId?: number) => string;
  completeProcessing: (id: string, success: boolean, data?: any) => void;
  updateProgress: (id: string, stage: string, progress: number) => void;

  trackVideoProcessing: (videoName: string, videoId: number, onComplete?: (fullData: any) => void) => string;

  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;

  unreadCount: number;

  /** Global toast */
  toast: ToastState;
  showToast: (message: string, severity?: ToastSeverity) => void;
  hideToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function safeParseNotifications(raw: string | null): Notification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n: any) => n && typeof n === "object")
      .map((n: any) => ({
        id: String(n.id ?? crypto.randomUUID()),
        videoName: String(n.videoName ?? ""),
        success: Boolean(n.success),
        data: n.data,
        read: Boolean(n.read),
        timestamp: typeof n.timestamp === "number" ? n.timestamp : Date.now(),
        processing: Boolean(n.processing),
        videoId: typeof n.videoId === "number" ? n.videoId : undefined,
        processingStage: typeof n.processingStage === "string" ? n.processingStage : "",
        progress: typeof n.progress === "number" ? n.progress : 0,
      }));
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [toast, setToast] = useState<ToastState>({ open: false, message: "", severity: "info" });


  const pollersRef = useRef<Map<number, number>>(new Map());

  const stopPolling = useCallback((videoId: number) => {
    const intervalId = pollersRef.current.get(videoId);
    if (intervalId) window.clearInterval(intervalId);
    pollersRef.current.delete(videoId);
  }, []);

  const clearAll = useCallback(() => {
    pollersRef.current.forEach((intervalId) => window.clearInterval(intervalId));
    pollersRef.current.clear();
    setNotifications([]);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("brakepoint_notifications");
    const loaded = safeParseNotifications(stored);
    setNotifications(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("brakepoint_notifications", JSON.stringify(notifications));
  }, [notifications, hydrated]);

  useEffect(() => {
    return () => {
      pollersRef.current.forEach((intervalId) => window.clearInterval(intervalId));
      pollersRef.current.clear();
    };
  }, []);

  const showToast = useCallback((message: string, severity: ToastSeverity = "info") => {
    setToast({ open: true, message, severity });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  // Auto-clear draw error after 5 seconds
  const ERROR_LENGTH_SECONDS = 5;
  const AUTO_HIDE_TOAST = true;
  useEffect(() => {
    if (!AUTO_HIDE_TOAST || toast != null || !toast) return;
    const t = setTimeout(() => hideToast(), ERROR_LENGTH_SECONDS*1000);
    return () => clearTimeout(t);
  }, [toast]);

  const addNotification = useCallback((videoName: string, success: boolean, data?: any) => {
    const now = Date.now();
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      videoName,
      success,
      data,
      read: false,
      timestamp: now,
      processing: false,
    };

    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const addProcessingNotification = useCallback((videoName: string, videoId?: number) => {
    const now = Date.now();
    const id = crypto.randomUUID();

    const newNotification: Notification = {
      id,
      videoName,
      success: false,
      read: false,
      timestamp: now,
      processing: true,
      videoId,
      processingStage: "",
      progress: 0,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    return id;
  }, []);

  const completeProcessing = useCallback((id: string, success: boolean, data?: any) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              processing: false,
              success,
              data,
              processingStage: "complete",
              progress: 100,
            }
          : n,
      ),
    );
  }, []);

  const updateProgress = useCallback((id: string, stage: string, progress: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, processingStage: stage, progress } : n)));
  }, []);

  const startPollingForVideo = useCallback(
    (notifId: string, videoId: number, onComplete?: (fullData: any) => void) => {
      if (pollersRef.current.has(videoId)) return;

      const intervalId = window.setInterval(async () => {
        try {
          const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/progress/`, {}, (newResp) => {
            // emergency contingency for a 401 UNAUTHORIZED
            if (newResp.status === 401) {
              stopPolling(videoId);
              clearAll()
            }
          });
          if (!response.ok) {
            // if 404 NOT FOUND stop processing immediately
            if (response.status === 404) {
              stopPolling(videoId);
              completeProcessing(notifId, false)
            }
            return;
          };

          const data = await response.json();
          if (!data?.success) return;

          const { processing_status, processing_stage, yolo_progress } = data;

          let overallProgress = 0;
          if (processing_stage === "yolo") overallProgress = Math.min(yolo_progress ?? 0, 99);
          else if (processing_stage === "complete") overallProgress = 100;

          updateProgress(notifId, processing_stage ?? "", overallProgress);

          if (processing_status === "completed") {
            stopPolling(videoId);

            let videoData = data;
            const videoResponse = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/`);

            if (videoResponse.ok) {
              const fullData = await videoResponse.json();
              if (fullData.success && fullData.videos) {
                onComplete(fullData.videos);
                videoData = {
                  yolo_results: { total_unique: fullData.videos.vehicles || 0 },
                  sign_results: { unique_signs: fullData.videos.signs || 0 },
                }
              }
            }

            completeProcessing(notifId, true, videoData);
          }

          if (processing_status === "failed") {
            stopPolling(videoId);
            completeProcessing(notifId, false, data);
          }
        } catch {
          // silent
        }
      }, 2000);

      pollersRef.current.set(videoId, intervalId);
    },
    [completeProcessing, stopPolling, updateProgress],
  );

  // onComplete are for extra functions to piggyback on the completion of this task
  const trackVideoProcessing = useCallback(
    (videoName: string, videoId: number, onComplete?: (fullData: any) => void) => {
      const notifId = addProcessingNotification(videoName, videoId);
      startPollingForVideo(notifId, videoId, onComplete);
      return notifId;
    },
    [addProcessingNotification, startPollingForVideo],
  );

  useEffect(() => {
    if (!hydrated) return;
    const processingNotifs = notifications.filter((n) => n.processing && typeof n.videoId === "number");
    processingNotifs.forEach((n) => startPollingForVideo(n.id, n.videoId!));
  }, [hydrated, notifications, startPollingForVideo]);

  const removeNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const toRemove = prev.find((n) => n.id === id);
        if (toRemove?.processing && typeof toRemove.videoId === "number") {
          stopPolling(toRemove.videoId);
        }
        return prev.filter((n) => n.id !== id);
      });
    },
    [stopPolling],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<NotificationContextType>(
    () => ({
      hydrated,

      notifications,
      addNotification,
      addProcessingNotification,
      completeProcessing,
      updateProgress,
      trackVideoProcessing,

      removeNotification,
      markAsRead,
      clearAll,
      unreadCount,

      toast,
      showToast,
      hideToast,
    }),
    [
      hydrated,
      notifications,
      addNotification,
      addProcessingNotification,
      completeProcessing,
      updateProgress,
      trackVideoProcessing,
      removeNotification,
      markAsRead,
      clearAll,
      unreadCount,
      toast,
      showToast,
      hideToast,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}