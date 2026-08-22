import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TransferEvent {
  name?: string;
  size?: number;
  uploadedAt?: string;
  progress?: number;
  speed?: number;
  error?: string;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected] = useState(false);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // socket.on('connect', () => setConnected(true));
    // socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  function onUploadCompleted(callback: (file: TransferEvent) => void) {
    socketRef.current?.on('upload_completed', callback);
  }

  function onFileDeleted(callback: (file: TransferEvent) => void) {
    socketRef.current?.on('file_deleted', callback);
  }

  function onUploadStarted(callback: (data: TransferEvent) => void) {
    socketRef.current?.on('upload_started', callback);
  }

  function onUploadProgress(callback: (data: TransferEvent) => void) {
    socketRef.current?.on('upload_progress', callback);
  }

  function onUploadFailed(callback: (data: TransferEvent) => void) {
    socketRef.current?.on('upload_failed', callback);
  }

  function offUploadCompleted(callback: (file: TransferEvent) => void) {
    socketRef.current?.off('upload_completed', callback);
  }

  function offFileDeleted(callback: (file: TransferEvent) => void) {
    socketRef.current?.off('file_deleted', callback);
  }

  function offUploadStarted(callback: (data: TransferEvent) => void) {
    socketRef.current?.off('upload_started', callback);
  }

  function offUploadFailed(callback: (data: TransferEvent) => void) {
    socketRef.current?.off('upload_failed', callback);
  }

  return {
    connected,
    onUploadCompleted,
    onFileDeleted,
    onUploadStarted,
    onUploadProgress,
    onUploadFailed,
    offUploadCompleted,
    offFileDeleted,
    offUploadStarted,
    offUploadFailed,
  };
}