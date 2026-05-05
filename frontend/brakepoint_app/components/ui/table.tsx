'use client';

import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, Toolbar, ToolbarButton } from '@mui/x-data-grid';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Box, Typography, Snackbar, Alert } from '@mui/material';

import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TuneIcon from '@mui/icons-material/Tune';

import './table.css';
import { authFetch } from '@/lib/authFetch';

// --- Perspective Transform Helpers ---
function computeHomography(src: {x:number,y:number}[], dst: {x:number,y:number}[]): number[][] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const {x: sx, y: sy} = src[i];
    const {x: dx, y: dy} = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx*sx, -dx*sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy*sx, -dy*sy]);
    b.push(dy);
  }
  const n = 8;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) return [[1,0,0],[0,1,0],[0,0,1]];
    for (let j = col; j <= n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  const h = aug.map(row => row[n]);
  return [[h[0],h[1],h[2]], [h[3],h[4],h[5]], [h[6],h[7],1]];
}

function invertMatrix3x3(m: number[][]): number[][] {
  const [[a,b,c],[d,e,f],[g,h,i]] = m;
  const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
  if (Math.abs(det) < 1e-10) return [[1,0,0],[0,1,0],[0,0,1]];
  const inv = 1/det;
  return [
    [(e*i-f*h)*inv, (c*h-b*i)*inv, (b*f-c*e)*inv],
    [(f*g-d*i)*inv, (a*i-c*g)*inv, (c*d-a*f)*inv],
    [(d*h-e*g)*inv, (b*g-a*h)*inv, (a*e-b*d)*inv]
  ];
}

function transformPoint(H: number[][], p: {x:number,y:number}): {x:number,y:number} {
  const w = H[2][0]*p.x + H[2][1]*p.y + H[2][2];
  return {
    x: (H[0][0]*p.x + H[0][1]*p.y + H[0][2]) / w,
    y: (H[1][0]*p.x + H[1][1]*p.y + H[1][2]) / w
  };
}

interface ToolbarProps {
  title? : string;
  onAdd: () => void;
  onEdit: () => void;
  onEditCalibration: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

interface TableProps {
  onVideoFileSelect: (url: string, thumbnail?: string) => void;
  hideUpload?: boolean;
  cameraId?: number | null;
  onUploadComplete?: () => void;
  visibleCameraIds?: number[];
  onUploadStart?: (videoName: string) => void;
  onProcessingStart?: (videoName: string, videoId: number) => void;
  onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;
  onVideoSelect?: (videoData: any) => void;
  onMultipleVideoSelect?: (videoDataArray: any[]) => void;
}
interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    video_name: string;
    file_name: File | null;
    calibration_points: { x: number; y: number }[];
    reference_distance_meters?: number;
  }) => void;
  onVideoFileSelect: (url: string) => void;
  cameraId?: number | null;
  onUploadComplete?: () => void;
  onUploadStart?: (videoName: string) => void;
  onProcessingStart?: (videoName: string, videoId: number) => void;
  onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;
  initialCalibrationPoints?: { x: number; y: number }[];
  initialReferencePoints?: { x: number; y: number }[];
  initialReferenceDistance?: number;
  editVideoId?: number | null;
  initialThumbnail?: string | null;
}

function AddModal({ open, onClose, onSubmit, onVideoFileSelect, cameraId, onUploadComplete, onUploadStart, onProcessingStart, onProcessingComplete, initialCalibrationPoints, initialReferencePoints, initialReferenceDistance, editVideoId, initialThumbnail }: AddModalProps) {
  const [video_name, setVideoName] = React.useState('');
  const [file_name, setFile] = React.useState<File | null>(null);
  const [showCalibration, setShowCalibration] = React.useState(false);
  const isEditMode = editVideoId !== null && editVideoId !== undefined;
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [uploadThumbnail, setUploadThumbnail] = React.useState<string | null>(null);
  const [calibrationPoints, setCalibrationPoints] = React.useState<{ x: number; y: number }[]>([]);
  const [referencePoints, setReferencePoints] = React.useState<{ x: number; y: number }[]>([]);
  const [referenceDistance, setReferenceDistance] = React.useState<number>(3); 
  const [showReferenceStep, setShowReferenceStep] = React.useState(false); 
  const [videoDimensions, setVideoDimensions] = React.useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [showWarning, setShowWarning] = React.useState(false);
  const [pendingPoint, setPendingPoint] = React.useState<{ x: number; y: number } | null>(null);
  const warpedCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [warpDimensions, setWarpDimensions] = React.useState({ width: 0, height: 0 });
  const [homographyInv, setHomographyInv] = React.useState<number[][] | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const thumbnailImageRef = React.useRef<HTMLImageElement | null>(null);

  // Reset all state when dialog closes (cancel should start fresh)
  React.useEffect(() => {
    if (!open) {
      setVideoName('');
      setFile(null);
      setShowCalibration(false);
      setCalibrationPoints([]);
      setReferencePoints([]);
      setShowReferenceStep(false);
      setReferenceDistance(3);
      setVideoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setWarpDimensions({ width: 0, height: 0 });
      setHomographyInv(null);
      warpedCanvasRef.current = null;
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setMousePos(null);
    }
  }, [open]);

  // Load thumbnail when editing (but start with empty points for fresh calibration)
React.useEffect(() => {
  if (!open) return;

  // In edit mode, show calibration UI but start with empty points
  if (isEditMode) {
    setShowCalibration(true);
  }
}, [open, isEditMode]);

// Load thumbnail as frame when editing calibration
React.useEffect(() => {
  if (!open) return;
  if (!editVideoId) return;
  if (!initialThumbnail) return;

  setShowCalibration(true);
  setVideoUrl(initialThumbnail);

  // draw thumbnail onto canvas once loaded
  const img = new Image();
  img.src = initialThumbnail;
  img.onload = () => {
    thumbnailImageRef.current = img;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = img.width;
    canvas.height = img.height;

    setVideoDimensions({ width: img.width, height: img.height });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
    }
  };
}, [open, editVideoId, initialThumbnail]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);

      if (selected.type.startsWith('video/')) {
        const url = URL.createObjectURL(selected);
        setVideoUrl(url);
        setShowCalibration(true);
        onVideoFileSelect(url); 
      }      
      if (selected.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(selected);
      } else {
      }
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      video.currentTime = 0.1;
    }
  };

  const handleVideoSeeked = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // In upload mode, capture this frame as thumbnail for later use
        if (!isEditMode) {
          const thumbnailDataUrl = canvas.toDataURL('image/png');
          setUploadThumbnail(thumbnailDataUrl);
          
          // Load into thumbnailImageRef for calibration display
          const img = new Image();
          img.src = thumbnailDataUrl;
          img.onload = () => {
            thumbnailImageRef.current = img;
          };
        }
      }
    }
  };

  // Compute perspective warp of video frame using 4 calibration points
  const computeWarp = (srcPoints: {x:number,y:number}[]) => {
    let sourceImage: HTMLImageElement | HTMLVideoElement | null = null;
    let sourceWidth = 0;
    let sourceHeight = 0;

    // In edit mode, use thumbnail; in upload mode, use video
    if (isEditMode && thumbnailImageRef.current) {
      sourceImage = thumbnailImageRef.current;
      sourceWidth = thumbnailImageRef.current.width;
      sourceHeight = thumbnailImageRef.current.height;
    } else {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      sourceImage = video;
      sourceWidth = video.videoWidth;
      sourceHeight = video.videoHeight;
    }

    // Compute destination rectangle (same math as backend)
    const w = Math.max(
      Math.hypot(srcPoints[1].x - srcPoints[0].x, srcPoints[1].y - srcPoints[0].y),
      Math.hypot(srcPoints[2].x - srcPoints[3].x, srcPoints[2].y - srcPoints[3].y)
    );
    const h = Math.max(
      Math.hypot(srcPoints[3].x - srcPoints[0].x, srcPoints[3].y - srcPoints[0].y),
      Math.hypot(srcPoints[2].x - srcPoints[1].x, srcPoints[2].y - srcPoints[1].y)
    );
    const dstW = Math.max(Math.round(w), 1);
    const dstH = Math.max(Math.round(h), 1);

    const dstPoints = [
      {x: 0, y: 0}, {x: dstW, y: 0},
      {x: dstW, y: dstH}, {x: 0, y: dstH}
    ];

    const H = computeHomography(srcPoints, dstPoints);
    const H_inv = invertMatrix3x3(H);

    // Get source pixels from image/video frame
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = sourceWidth;
    srcCanvas.height = sourceHeight;
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.drawImage(sourceImage, 0, 0);
    const srcImg = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const srcData = srcImg.data;
    const srcW = srcImg.width;
    const srcH = srcImg.height;

    // Create warped image via inverse mapping
    const warpCanvas = document.createElement('canvas');
    warpCanvas.width = dstW;
    warpCanvas.height = dstH;
    const warpCtx = warpCanvas.getContext('2d')!;
    const warpImg = warpCtx.createImageData(dstW, dstH);
    const dstData = warpImg.data;

    for (let dy = 0; dy < dstH; dy++) {
      for (let dx = 0; dx < dstW; dx++) {
        const wv = H_inv[2][0]*dx + H_inv[2][1]*dy + H_inv[2][2];
        const sx = (H_inv[0][0]*dx + H_inv[0][1]*dy + H_inv[0][2]) / wv;
        const sy = (H_inv[1][0]*dx + H_inv[1][1]*dy + H_inv[1][2]) / wv;
        const sxi = Math.round(sx);
        const syi = Math.round(sy);
        if (sxi >= 0 && sxi < srcW && syi >= 0 && syi < srcH) {
          const si = (syi * srcW + sxi) * 4;
          const di = (dy * dstW + dx) * 4;
          dstData[di] = srcData[si];
          dstData[di+1] = srcData[si+1];
          dstData[di+2] = srcData[si+2];
          dstData[di+3] = srcData[si+3];
        }
      }
    }
    warpCtx.putImageData(warpImg, 0, 0);

    warpedCanvasRef.current = warpCanvas;
    setWarpDimensions({width: dstW, height: dstH});
    setHomographyInv(H_inv);
    setShowReferenceStep(true);
    setZoom(1);
    setPan({x: 0, y: 0});
  };

  // Redraw warped frame when entering reference step
  React.useEffect(() => {
    if (showReferenceStep && warpedCanvasRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(warpedCanvasRef.current, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [showReferenceStep, warpDimensions]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    const x = (canvasX - pan.x) / zoom;
    const y = (canvasY - pan.y) / zoom;

    // Step 1: Select 4 calibration points for perspective transform
    if (!showReferenceStep && calibrationPoints.length < 4) {
      const maxExtrapolation = Math.max(canvas.width, canvas.height) * 0.5;
      const isExtremePoint = 
        x < -maxExtrapolation || 
        x > canvas.width + maxExtrapolation ||
        y < -maxExtrapolation || 
        y > canvas.height + maxExtrapolation;

      if (isExtremePoint) {
        setPendingPoint({ x, y });
        setShowWarning(true);
        return;
      }

      const newPoints = [...calibrationPoints, { x, y }];
      setCalibrationPoints(newPoints);
      drawPoints(newPoints, referencePoints);
      
      // Move to reference point selection — show bird's-eye view
      if (newPoints.length === 4) {
        computeWarp(newPoints);
      }
      return;
    }

    // Step 2: Select 2 reference points for scale calculation
    if (showReferenceStep && referencePoints.length < 2) {
      const newPoints = [...referencePoints, { x, y }];
      setReferencePoints(newPoints);
      drawPoints(calibrationPoints, newPoints);
    }
  };

  const handleConfirmExtremePoint = () => {
    if (pendingPoint) {
      const newPoints = [...calibrationPoints, pendingPoint];
      setCalibrationPoints(newPoints);
      drawPoints(newPoints, referencePoints);
      setPendingPoint(null);
      // Move to reference point selection if 4th point was extreme
      if (newPoints.length === 4) {
        computeWarp(newPoints);
      }
    }
    setShowWarning(false);
  };

  const handleCancelExtremePoint = () => {
    setPendingPoint(null);
    setShowWarning(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    if (isPanning) {
      const panSensitivity = 0.45;
      const dx = (canvasX - panStart.x) * panSensitivity;
      const dy = (canvasY - panStart.y) * panSensitivity;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: canvasX, y: canvasY });
      drawPoints(calibrationPoints, referencePoints);
      return;
    }

    // Show crosshairs when adding points
    const needsMorePoints = (!showReferenceStep && calibrationPoints.length < 4) || 
                            (showReferenceStep && referencePoints.length < 2);
    
    if (needsMorePoints) {
      const x = (canvasX - pan.x) / zoom;
      const y = (canvasY - pan.y) / zoom;
      setMousePos({ x, y });
      drawPoints(calibrationPoints, referencePoints, { x, y });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || e.shiftKey) { // Right click or Shift + Left click
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      setIsPanning(true);
      setPanStart({ x: canvasX, y: canvasY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(5, zoom * zoomFactor));

    const dx = mouseX - pan.x;
    const dy = mouseY - pan.y;
    
    setPan({
      x: mouseX - dx * (newZoom / zoom),
      y: mouseY - dy * (newZoom / zoom)
    });
    
    setZoom(newZoom);
    setTimeout(() => drawPoints(calibrationPoints, referencePoints, mousePos), 0);
  };

  const handleCanvasMouseLeave = () => {
    setMousePos(null);
    drawPoints(calibrationPoints, referencePoints);
  };

  const drawPoints = (
    fourPoints: { x: number; y: number }[], 
    twoPoints: { x: number; y: number }[],
    cursorPos?: { x: number; y: number }
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    // Draw warped bird's-eye view in reference step, original frame otherwise
    if (showReferenceStep && warpedCanvasRef.current) {
      ctx.drawImage(warpedCanvasRef.current, 0, 0, canvas.width, canvas.height);
    } else if (thumbnailImageRef.current) {
      // Use cached thumbnail (both edit and upload modes)
      ctx.drawImage(thumbnailImageRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Fallback to video frame if thumbnail not yet loaded
      const video = videoRef.current;
      if (video) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }

    // Draw guide lines and preview connections
    if (cursorPos) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      
      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(cursorPos.x, 0);
      ctx.lineTo(cursorPos.x, canvas.height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, cursorPos.y);
      ctx.lineTo(canvas.width, cursorPos.y);
      ctx.stroke();
      
      // Preview connection to previous point(s)
      if (!showReferenceStep && fourPoints.length > 0 && fourPoints.length < 4) {
        ctx.strokeStyle = 'rgba(22, 27, 76, 0.6)';
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([10 / zoom, 5 / zoom]);
        
        // Draw line from last point to cursor
        ctx.beginPath();
        ctx.moveTo(fourPoints[fourPoints.length - 1].x, fourPoints[fourPoints.length - 1].y);
        ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.stroke();
        
        // If 3 points exist, show preview of closing line
        if (fourPoints.length === 3) {
          ctx.strokeStyle = 'rgba(22, 27, 76, 0.3)';
          ctx.setLineDash([5 / zoom, 10 / zoom]);
          ctx.beginPath();
          ctx.moveTo(cursorPos.x, cursorPos.y);
          ctx.lineTo(fourPoints[0].x, fourPoints[0].y);
          ctx.stroke();
        }
      }
      
      // Preview reference line
      if (showReferenceStep && twoPoints.length === 1) {
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.6)';
        ctx.lineWidth = 4 / zoom;
        ctx.setLineDash([10 / zoom, 5 / zoom]);
        ctx.beginPath();
        ctx.moveTo(twoPoints[0].x, twoPoints[0].y);
        ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }

    // Draw 4-point calibration polygon (only in step 1 — original frame)
    if (!showReferenceStep && fourPoints.length > 0) {
      if (fourPoints.length === 4) {
        ctx.fillStyle = 'rgba(22, 27, 76, 0.3)';
        ctx.beginPath();
        ctx.moveTo(fourPoints[0].x, fourPoints[0].y);
        ctx.lineTo(fourPoints[1].x, fourPoints[1].y);
        ctx.lineTo(fourPoints[2].x, fourPoints[2].y);
        ctx.lineTo(fourPoints[3].x, fourPoints[3].y);
        ctx.closePath();
        ctx.fill();
      }

      fourPoints.forEach((point, index) => {
        // Outer ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 14 / zoom, 0, 2 * Math.PI);
        ctx.stroke();
        // Inner filled circle
        ctx.fillStyle = '#161b4cff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12 / zoom, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label with background
        const label = `${index + 1}`;
        ctx.font = `bold ${22 / zoom}px Arial`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(22, 27, 76, 0.85)';
        ctx.beginPath();
        ctx.roundRect(point.x + 14 / zoom, point.y - 18 / zoom, tw + 10 / zoom, 26 / zoom, 4 / zoom);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, point.x + 19 / zoom, point.y + 3 / zoom);

        if (index > 0) {
          ctx.strokeStyle = '#161b4cff';
          ctx.lineWidth = 3 / zoom;
          ctx.beginPath();
          ctx.moveTo(fourPoints[index - 1].x, fourPoints[index - 1].y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      });

      if (fourPoints.length === 4) {
        ctx.strokeStyle = '#161b4cff';
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        ctx.moveTo(fourPoints[3].x, fourPoints[3].y);
        ctx.lineTo(fourPoints[0].x, fourPoints[0].y);
        ctx.stroke();
      }
    }

    // Draw 2-point reference line (on top of polygon)
    if (twoPoints.length > 0) {
      twoPoints.forEach((point, index) => {
        // Outer ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 16 / zoom, 0, 2 * Math.PI);
        ctx.stroke();
        // Inner filled circle
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 14 / zoom, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label with background
        const refLabel = `R${index + 1}`;
        ctx.font = `bold ${22 / zoom}px Arial`;
        const rtw = ctx.measureText(refLabel).width;
        ctx.fillStyle = 'rgba(76, 175, 80, 0.85)';
        ctx.beginPath();
        ctx.roundRect(point.x + 16 / zoom, point.y - 18 / zoom, rtw + 10 / zoom, 26 / zoom, 4 / zoom);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(refLabel, point.x + 21 / zoom, point.y + 3 / zoom);

        if (index === 1) {
          ctx.strokeStyle = '#4CAF50';
          ctx.lineWidth = 5 / zoom;
          ctx.beginPath();
          ctx.moveTo(twoPoints[0].x, twoPoints[0].y);
          ctx.lineTo(twoPoints[1].x, twoPoints[1].y);
          ctx.stroke();
          
          const midX = (twoPoints[0].x + twoPoints[1].x) / 2;
          const midY = (twoPoints[0].y + twoPoints[1].y) / 2;
          // Distance label background
          const distLabel = `${referenceDistance}m`;
          ctx.font = `bold ${28 / zoom}px Arial`;
          const dtw = ctx.measureText(distLabel).width;
          ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
          ctx.beginPath();
          ctx.roundRect(midX - dtw / 2 - 6 / zoom, midY - 36 / zoom, dtw + 12 / zoom, 34 / zoom, 6 / zoom);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(distLabel, midX - dtw / 2, midY - 10 / zoom);
        }
      });
    }

    ctx.restore();
  };

  const resetCalibration = () => {
    setCalibrationPoints([]);
    setReferencePoints([]);
    setShowReferenceStep(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    warpedCanvasRef.current = null;
    setWarpDimensions({ width: 0, height: 0 });
    setHomographyInv(null);
    
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // In edit mode, redraw thumbnail
        if (isEditMode && thumbnailImageRef.current) {
          ctx.drawImage(thumbnailImageRef.current, 0, 0, canvas.width, canvas.height);
        } else if (videoRef.current && videoRef.current.readyState >= 2) {
          // In upload mode, redraw video frame
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        }
      }
    }
    
    // Redraw empty state with proper background
    setTimeout(() => drawPoints([], []), 0);
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTimeout(() => drawPoints(calibrationPoints, referencePoints), 0);
  };

  const handleBackToUpload = () => {
    setShowCalibration(false);
    setCalibrationPoints([]);
    setReferencePoints([]);
    setShowReferenceStep(false);
    setVideoName('');
    setFile(null);
    warpedCanvasRef.current = null;
    setWarpDimensions({ width: 0, height: 0 });
    setHomographyInv(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  };

  const handleSubmit = async () => {
    // Validation for both modes
    if (calibrationPoints.length !== 4) {
      alert('Please select 4 calibration points for perspective transform');
      return;
    }

    if (referencePoints.length !== 2) {
      alert('Please select 2 reference points for scale calculation (e.g., road marking edges)');
      return;
    }

    if (!referenceDistance || referenceDistance <= 0) {
      alert('Please provide a valid reference distance in meters');
      return;
    }

    // Edit mode: update calibration via PATCH
    if (isEditMode && editVideoId) {
      const originalReferencePoints = homographyInv
        ? referencePoints.map(p => transformPoint(homographyInv, p))
        : referencePoints;

      const savedVideoUrl = videoUrl;

      setShowCalibration(false);
      setCalibrationPoints([]);
      setReferencePoints([]);
      setShowReferenceStep(false);
      setReferenceDistance(3);
      setVideoUrl(null);
      warpedCanvasRef.current = null;
      setWarpDimensions({ width: 0, height: 0 });
      setHomographyInv(null);
      onClose();

      try {
        console.log('[calibration-edit] Updating calibration for video', editVideoId);
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${editVideoId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calibration_points: calibrationPoints,
            reference_points: originalReferencePoints,
            reference_distance_meters: referenceDistance,
          }),
        });

        if (savedVideoUrl) URL.revokeObjectURL(savedVideoUrl);

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('[calibration-edit] Non-JSON response:', response.status, contentType);
          if (onProcessingComplete) {
            onProcessingComplete('Calibration Update', false, { error: `Server error (${response.status})` });
          }
          return;
        }

        const data = await response.json();
        console.log('[calibration-edit] Response data:', data);

        if (!response.ok) {
          console.error('[calibration-edit] Update failed:', response.status, data);
          if (onProcessingComplete) {
            onProcessingComplete('Calibration Update', false, { error: data.error || data.detail || 'Update failed' });
          }
          return;
        }

        if (onProcessingComplete) {
          onProcessingComplete('Calibration Update', true, { message: 'Calibration updated successfully' });
        }

        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (err) {
        if (savedVideoUrl) URL.revokeObjectURL(savedVideoUrl);
        console.error('[calibration-edit] Error caught:', err);
        if (onProcessingComplete) {
          onProcessingComplete('Calibration Update', false, { error: String(err) || 'Failed to update calibration' });
        }
      }
      return;
    }

    // New upload mode: POST with file
    if (!video_name || !file_name) {
      alert('Please provide a video name and file');
      return;
    }

    if (!cameraId) {
      alert('Please select a camera first');
      return;
    }

    const originalReferencePoints = homographyInv
      ? referencePoints.map(p => transformPoint(homographyInv, p))
      : referencePoints;

    const savedFile = file_name;
    const uploadingVideoName = video_name;
    const savedCalibrationPoints = [...calibrationPoints];
    const savedReferenceDistance = referenceDistance;
    const savedVideoUrl = videoUrl;

    const formData = new FormData();
    formData.append('file', savedFile);
    formData.append('video_name', uploadingVideoName);
    formData.append('camera_id', cameraId.toString());
    formData.append('calibration_points', JSON.stringify(calibrationPoints));
    formData.append('reference_points', JSON.stringify(originalReferencePoints));
    formData.append('reference_distance_meters', referenceDistance.toString());
    if (uploadThumbnail) {
      formData.append('thumbnail', uploadThumbnail);
    }

    setVideoName('');
    setFile(null);
    setShowCalibration(false);
    setCalibrationPoints([]);
    setReferencePoints([]);
    setShowReferenceStep(false);
    setReferenceDistance(3);
    setVideoUrl(null);
    warpedCanvasRef.current = null;
    setWarpDimensions({ width: 0, height: 0 });
    setHomographyInv(null);
    onClose();

    if (onUploadStart) onUploadStart(uploadingVideoName);

    try {
      console.log('[upload] Sending upload request...', { videoName: uploadingVideoName, cameraId });
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload_and_process/`, {
        method: 'POST',
        body: formData,
      });

      if (savedVideoUrl) URL.revokeObjectURL(savedVideoUrl);

      console.log('[upload] Response status:', response.status);

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.error('[upload] Non-JSON response:', response.status, contentType);
        if (onProcessingComplete) {
          onProcessingComplete(uploadingVideoName, false, { error: `Server error (${response.status})` });
        }
        return;
      }

      const data = await response.json();
      console.log('[upload] Response data:', data);

      if (!response.ok) {
        console.error('[upload] Upload failed:', response.status, data);
        if (onProcessingComplete) {
          onProcessingComplete(uploadingVideoName, false, { error: data.error || data.detail || 'Upload failed' });
        }
        return;
      }

      if (data.video_id && onProcessingStart) {
        onProcessingStart(uploadingVideoName, data.video_id);
      }

      onSubmit({ 
        video_name: uploadingVideoName, 
        file_name: savedFile, 
        calibration_points: savedCalibrationPoints,
        reference_distance_meters: savedReferenceDistance
      });

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      if (savedVideoUrl) URL.revokeObjectURL(savedVideoUrl);
      console.error('[upload] Upload error caught:', err);
      if (onProcessingComplete) {
        onProcessingComplete(uploadingVideoName, false, { error: String(err) || 'Failed to process video' });
      }
    }
  };

  return (
    <Dialog className="add-modal" open={open} onClose={onClose} maxWidth={showCalibration ? false : "md"} fullWidth sx={{zIndex: 500000, ...(showCalibration ? { '& .MuiDialog-paper': { maxWidth: '95vw', width: '95vw', maxHeight: '95vh', height: '95vh' } } : {})}}>
      <DialogTitle>
        {showCalibration ? (isEditMode ? 'Edit Video Calibration' : 'Camera Calibration') : 'Add New Video'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0, pb: 1, overflow: 'hidden' }}>
        {!showCalibration ? (
          <>
            <TextField
              label="Video Name"
              variant="outlined"
              value={video_name}
              onChange={(e) => setVideoName(e.target.value)}
              fullWidth
            />

            <Button variant="contained" component="label">
              Upload File
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={handleFileChange}
              />
            </Button>
          </>
        ) : (
          <>
            {/* Step indicator banner */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 2, p: 2, mb: 1,
              borderRadius: 2,
              bgcolor: showReferenceStep ? '#e8f5e9' : '#e3f2fd',
              border: `2px solid ${showReferenceStep ? '#4caf50' : '#1565c0'}`,
            }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '50%',
                bgcolor: showReferenceStep ? '#4caf50' : '#1565c0',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1.25rem', flexShrink: 0,
              }}>
                {showReferenceStep ? '2' : '1'}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.3 }}>
                  {showReferenceStep
                    ? 'Set Scale with Reference Points (Bird\u2019s Eye View)'
                    : 'Select 4 Corner Points'}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.95rem' }}>
                  {showReferenceStep
                    ? 'Click 2 points on a road marking with known width (e.g., lane edges \u2248 3m). Use markings near the center for best accuracy.'
                    : 'Click on the video frame to mark 4 corners in order: top-left \u2192 top-right \u2192 bottom-right \u2192 bottom-left.'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', flexShrink: 0, px: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: showReferenceStep ? '#4caf50' : '#1565c0' }}>
                  {showReferenceStep ? `${referencePoints.length}/2` : `${calibrationPoints.length}/4`}
                </Typography>
                <Typography variant="caption" color="text.secondary">points</Typography>
              </Box>
            </Box>

            {/* Navigation hints — compact */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ bgcolor: '#f5f5f5', px: 1, py: 0.25, borderRadius: 1 }}>
                🔍 <strong>Scroll</strong> to zoom
              </Typography>
              <Typography variant="caption" sx={{ bgcolor: '#f5f5f5', px: 1, py: 0.25, borderRadius: 1 }}>
                ✋ <strong>Right-click</strong> or <strong>Shift+drag</strong> to pan
              </Typography>
            </Box>

            <Box sx={{ position: 'relative', width: '100%', backgroundColor: '#000', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <video
                ref={videoRef}
                src={videoUrl || ''}
                onLoadedMetadata={handleVideoLoad}
                onSeeked={handleVideoSeeked}
                onLoadedData={handleVideoSeeked}
                style={{ display: 'none' }}
                preload="auto"
              />
              <canvas
                ref={canvasRef}
                width={showReferenceStep && warpDimensions.width > 0 ? warpDimensions.width : videoDimensions.width}
                height={showReferenceStep && warpDimensions.height > 0 ? warpDimensions.height : videoDimensions.height}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: 'calc(95vh - 280px)',
                  cursor: isPanning ? 'grabbing' : 'crosshair',
                  border: `3px solid ${showReferenceStep ? '#4caf50' : '#1565c0'}`,
                  borderRadius: '8px',
                  display: 'block',
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                {showReferenceStep
                  ? `🟢 Reference: ${referencePoints.length}/2 · Zoom: ${zoom.toFixed(1)}x`
                  : `🔵 Calibration: ${calibrationPoints.length}/4 · Zoom: ${zoom.toFixed(1)}x`}
              </Typography>
              {showReferenceStep && (
                <TextField
                  label="Ref. distance (m)"
                  type="number"
                  value={referenceDistance}
                  onChange={(e) => setReferenceDistance(parseFloat(e.target.value) || 0)}
                  inputProps={{ min: 0.1, step: 0.5 }}
                  size="small"
                  sx={{ width: 160 }}
                />
              )}
              <Button variant="outlined" onClick={resetZoom} size="small">Reset View</Button>
              <Button
                variant="outlined"
                onClick={resetCalibration}
                disabled={calibrationPoints.length === 0 && referencePoints.length === 0}
                size="small"
              >
                Reset Points
              </Button>
            </Box>

            {calibrationPoints.length === 4 && referencePoints.length === 2 && (
              <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, border: '2px solid #4caf50' }}>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1rem' }}>
                  ✅ All points selected (4 calibration + 2 reference). You can now proceed with the upload.
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        {showCalibration && (
          <Button onClick={handleBackToUpload} color="secondary">
            Back
          </Button>
        )}
        <Button 
          onClick={showCalibration ? handleSubmit : undefined} 
          variant="contained" 
          color="primary"
          disabled={showCalibration && !(calibrationPoints.length === 4 && referencePoints.length === 2)}
        >
          {showCalibration ? 'Upload & Process' : 'Next'}
        </Button>
      </DialogActions>

      {/* Warning Dialog for Extreme Points */}
      <Dialog
        open={showWarning}
        onClose={handleCancelExtremePoint}
        maxWidth="sm"
        sx={{ zIndex: 500001 }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6">Point Outside Boundary</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This point is very far outside the image boundary. This might cause distortion in the perspective transformation.
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" color="info.dark">
              <strong>Note:</strong> Placing points outside the visible frame can be useful when corners aren't visible, 
              but extreme positions may lead to unexpected warping.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelExtremePoint} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleConfirmExtremePoint} variant="contained" color="warning">
            Add Point Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

interface EditModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (videoId: number, newName: string) => void;
  videoId: number | null;
  currentName: string;
}

function EditModal({ open, onClose, onSubmit, videoId, currentName }: EditModalProps) {
  const [videoName, setVideoName] = React.useState(currentName);

  React.useEffect(() => {
    setVideoName(currentName);
  }, [currentName, open]);

  const handleSubmit = () => {
    if (!videoName.trim()) {
      alert('Please provide a video name');
      return;
    }
    if (videoId !== null) {
      onSubmit(videoId, videoName.trim());
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Video Name</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <TextField
          label="Video Name"
          variant="outlined"
          value={videoName}
          onChange={(e) => setVideoName(e.target.value)}
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CustomToolbar({ title, onAdd, onEdit, onEditCalibration, onDelete, hasSelection } : ToolbarProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
      <Toolbar>
        <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
          {title}
        </Typography>
      
        <ToolbarButton onClick={onAdd}>
          <FileUploadIcon fontSize="small"/>
        </ToolbarButton>
        
        <ToolbarButton onClick={onEditCalibration} disabled={!hasSelection} title="Edit Calibration">
          <TuneIcon fontSize="small"/>
        </ToolbarButton>
        
        <ToolbarButton onClick={onDelete} disabled={!hasSelection}>
          <DeleteIcon fontSize="small"/>
        </ToolbarButton>

        <ToolbarButton onClick={onEdit} disabled={!hasSelection}>
          <EditIcon fontSize="small"/>
        </ToolbarButton>
      </Toolbar>
  )
}

export default function Table({ onVideoFileSelect, hideUpload = false, cameraId, onUploadComplete, visibleCameraIds = [], onUploadStart, onProcessingStart, onProcessingComplete, onVideoSelect, onMultipleVideoSelect }: TableProps) {
  const [handleOpenAddModal, setAddModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCalibrationModalOpen, setEditCalibrationModalOpen] = useState(false);
  const [editCalibrationVideoId, setEditCalibrationVideoId] = useState<number | null>(null);
  const [editCalibrationData, setEditCalibrationData] = useState<{
    calibration_points?: { x: number; y: number }[];
    reference_points?: { x: number; y: number }[];
    reference_distance_meters?: number;
    thumbnail?: string | null;
  }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const showCameraColumn = cameraId === null && visibleCameraIds.length > 0;

  const columns: GridColDef[] = [
      { field: 'id', headerName: 'ID', width: 60 },
      ...(showCameraColumn ? [{ field: 'camera_id', headerName: 'Camera', width: 80, align: 'center' as const, headerAlign: 'center' as const }] : []),
      { field: 'video_name', headerName: 'Video Name', flex: 1, minWidth: 150 },
      { field: 'uploaded_time', headerName: 'Uploaded', width: 160 },
      { field: 'vehicles', headerName: 'Vehicles', width: 80, align: 'center', headerAlign: 'center' },
      { field: 'speeding', headerName: 'Speeding', width: 85, align: 'center', headerAlign: 'center' },
      { field: 'swerving', headerName: 'Swerving', width: 85, align: 'center', headerAlign: 'center' },
      { field: 'abrupt_stop', headerName: 'Abrupt Stop', width: 100, align: 'center', headerAlign: 'center' },
      { field: 'jeepney_hotspot', headerName: 'Jeepney Hotspot', width: 130, align: 'center', headerAlign: 'center',
        renderCell: (params) => (
          <Box sx={{ 
            color: params.value ? '#4CAF50' : '#666',
            fontWeight: params.value ? 'bold' : 'normal'
          }}>
            {params.value ? 'Yes' : 'No'}
          </Box>
        )
      },
      { field: 'duration', headerName: 'Duration', width: 90, align: 'center', headerAlign: 'center' },
      { field: 'status', headerName: 'Status', width: 100,
        renderCell: (params) => (
          <Box sx={{ 
            color: params.value === 'completed' ? '#4CAF50' : 
                   params.value === 'failed' ? '#f44336' : 
                   params.value === 'processing' ? '#ff9800' : '#666',
            textTransform: 'capitalize'
          }}>
            {params.value}
          </Box>
        )
      },
  ]
  
  const [rows, setRows] = useState<any>([]);
  const [loading, setLoading] = useState(false);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      if (cameraId === null && visibleCameraIds.length > 0) {
        const videoPromises = visibleCameraIds.map(camId =>
          authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${camId}/videos/`)
            .then(res => res.json())
        );

        const results = await Promise.all(videoPromises);
        const allVideos: any[] = [];
        
        results.forEach(data => {
          if (data.success && data.videos) {
            allVideos.push(...data.videos);
          }
        });

        allVideos.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

        const transformedRows = allVideos.map((video: any) => ({
          id: video.id,
          camera_id: video.camera,
          video_name: video.filename,
          uploaded_time: new Date(video.uploaded_at).toLocaleString(),
          vehicles: video.vehicles || 0,
          signs: video.signs || 0,
          speeding: video.speeding_count || 0,
          swerving: video.swerving_count || 0,
          abrupt_stop: video.abrupt_stopping_count || 0,
          jeepney_hotspot: video.jeepney_hotspot || false,
          duration: video.duration_seconds ? `${Math.round(video.duration_seconds)}s` : 'N/A',
          status: video.processing_status || 'pending',
          sign_classes: video.sign_classes || [],
          thumbnail: video.thumbnail || null,
          calibration_points: video.calibration_points || [],
          reference_points: video.reference_points || [],
          reference_distance_meters: video.reference_distance_meters,
        }));
        setRows(transformedRows);
        setLoading(false);
        return;
      }

      if (cameraId === null) {
        setRows([]);
        setLoading(false);
        return;
      }

      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/videos/`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.videos) {
          const transformedRows = data.videos.map((video: any) => ({
            id: video.id,
            video_name: video.filename,
            uploaded_time: new Date(video.uploaded_at).toLocaleString(),
            vehicles: video.vehicles || 0,
            signs: video.signs || 0,
            speeding: video.speeding_count || 0,
            swerving: video.swerving_count || 0,
            abrupt_stop: video.abrupt_stopping_count || 0,
            jeepney_hotspot: video.jeepney_hotspot || false,
            duration: video.duration_seconds ? `${Math.round(video.duration_seconds)}s` : 'N/A',
            status: video.processing_status || 'pending',
            sign_classes: video.sign_classes || [],
            thumbnail: video.thumbnail || null,
            calibration_points: video.calibration_points || [],
            reference_points: video.reference_points || [],
            reference_distance_meters: video.reference_distance_meters,
          }));
          setRows(transformedRows);
        }
      } else {
        console.error('Failed to fetch videos:', response.statusText);
        setRows([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const visibleCameraIdsKey = visibleCameraIds.sort((a, b) => a - b).join(',');

  useEffect(() => {
    fetchVideos();
  }, [cameraId, visibleCameraIdsKey]);

  const handleAdd = (data: { video_name: string; file_name: File | null; calibration_points: { x: number; y: number }[] }) => {
    fetchVideos();
  };

  const handleEdit = () => {
    if (selectedRows.length !== 1) {
      alert('Please select exactly one video to edit');
      return;
    }
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (videoId: number, newName: string) => {
    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: newName }),
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Video name updated successfully', severity: 'success' });
        fetchVideos();
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        const errorData = await response.json();
        setSnackbar({ open: true, message: errorData.message || 'Failed to update video', severity: 'error' });
      }
    } catch (error) {
      console.error('Error updating video:', error);
      setSnackbar({ open: true, message: 'Error updating video', severity: 'error' });
    }
  };

  const handleDelete = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one video to delete');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleEditCalibration = () => {
    if (selectedRows.length !== 1) {
      alert('Please select exactly one video to edit calibration');
      return;
    }

    const video = selectedRows[0];
    setEditCalibrationVideoId(video.id);
    setEditCalibrationData({
      calibration_points: video.calibration_points || [],
      reference_points: video.reference_points || [],
      reference_distance_meters: video.reference_distance_meters,
      thumbnail: video.thumbnail || null,
    });
    setEditCalibrationModalOpen(true);
  };

  const handleEditCalibrationSubmit = async (data: Record<string, unknown>) => {
    if (!editCalibrationVideoId) {
      setSnackbar({
        open: true,
        message: 'Error: No video selected for calibration edit',
        severity: 'error',
      });
      return;
    }

    try {
      const patchData: Record<string, unknown> = {
        calibration_points: data.calibration_points,
        reference_points: data.reference_points,
        reference_distance_meters: data.reference_distance_meters,
      };

      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/videos/${editCalibrationVideoId}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patchData),
        }
      );

      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Calibration updated successfully',
          severity: 'success',
        });
        setEditCalibrationModalOpen(false);
        // Refresh the video list
        fetchVideos();
      } else {
        const errorData = await response.json();
        setSnackbar({
          open: true,
          message: `Failed to update calibration: ${errorData.detail || 'Unknown error'}`,
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error updating calibration:', error);
      setSnackbar({
        open: true,
        message: `Error updating calibration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const deletePromises = selectedRows.map(row =>
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${row.id}/`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedRows.length) {
        setSnackbar({ 
          open: true, 
          message: `Successfully deleted ${successCount} video${successCount > 1 ? 's' : ''}`, 
          severity: 'success' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: `Deleted ${successCount} of ${selectedRows.length} videos`, 
          severity: 'warning' 
        });
      }

      setDeleteDialogOpen(false);
      setSelectedRows([]);
      fetchVideos();
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error deleting videos:', error);
      setSnackbar({ open: true, message: 'Error deleting videos', severity: 'error' });
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box>
      <div className="table-container">
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize:  5} },
          }}
          slots={{
            toolbar: hideUpload ? undefined : () => <CustomToolbar 
              onAdd={() => setAddModalOpen(true)} 
              onEdit={handleEdit}
              onEditCalibration={handleEditCalibration}
              onDelete={handleDelete}
              hasSelection={selectedRows.length > 0}
            />,
          }}
          slotProps={{toolbar:
            {title: "Videos"}
          }}
          showToolbar={!hideUpload}
          checkboxSelection
          onRowSelectionModelChange={(newSelection) => {
            const selection: any = newSelection;
            const selectionIds = selection.ids ? Array.from(selection.ids) : [];
            const selectedVideos = rows.filter(row => selectionIds.includes(row.id));
            setSelectedRows(selectedVideos);
            
            if (onMultipleVideoSelect && selectedVideos.length > 1) {
              onMultipleVideoSelect(selectedVideos);
            } else if (onVideoSelect && selectedVideos.length === 1) {
              onVideoSelect(selectedVideos[0]);
            } else if (selectedVideos.length === 0 && onVideoSelect) {
              onVideoSelect(null);
            }
          }}
        />
      </div>
      {!hideUpload && (
        <>
          <AddModal 
            open={handleOpenAddModal} 
            onClose={() => setAddModalOpen(false)} 
            onSubmit={handleAdd} 
            onVideoFileSelect={onVideoFileSelect}
            cameraId={cameraId}
            onUploadComplete={onUploadComplete}
            onUploadStart={onUploadStart}
            onProcessingStart={onProcessingStart}
            onProcessingComplete={onProcessingComplete}
          />
          <EditModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSubmit={handleEditSubmit}
            videoId={selectedRows.length === 1 ? selectedRows[0].id : null}
            currentName={selectedRows.length === 1 ? selectedRows[0].video_name : ''}
          />
          <AddModal
            open={editCalibrationModalOpen}
            onClose={() => setEditCalibrationModalOpen(false)}
            onSubmit={handleEditCalibrationSubmit}
            onVideoFileSelect={onVideoFileSelect}
            cameraId={cameraId}
            editVideoId={editCalibrationVideoId}
            initialCalibrationPoints={editCalibrationData.calibration_points}
            initialReferencePoints={editCalibrationData.reference_points}
            initialReferenceDistance={editCalibrationData.reference_distance_meters}
            initialThumbnail={editCalibrationData.thumbnail}
          />
          <Dialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
          >
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete {selectedRows.length} video{selectedRows.length > 1 ? 's' : ''}?
                This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={handleDeleteConfirm} variant="contained" color="error">
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}