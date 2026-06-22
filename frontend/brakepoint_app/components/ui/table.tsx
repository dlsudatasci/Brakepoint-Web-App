'use client';

import React, { useState, useEffect } from 'react';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Box, Typography, Snackbar, Alert } from '@mui/material';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TuneIcon from '@mui/icons-material/Tune';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

import {
  CameraSummary, VideoSummary
} from '@/components/landing/summaryTypes'
import { CameraAddModal, CameraEditModal } from '@/components/landing/cameraModals'
import { useNotifications } from "@/contexts/NotificationContext";

import './table.css';
import { authFetch } from '@/lib/authFetch';


// ------ Calendar Helpers -------

const HOUR_START = 1;
const HOUR_END = 24;
const HOUR_HEIGHT = 56; // px per hour

// returns the date under the format of YYYY-MM-DD
function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// adds a number of days to the given Date object
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// formats hour labels for the row
function formatHourLabel(hour: number): string {
  if (hour === 12) return '12:00n';
  const suffix = hour < 12 ? 'a' : 'p';
  const h = hour > 12 ? hour - 12 : hour;
  return `${h}:00${suffix}`;
}

// Parse video row's uploaded_time into { dateKey, startHour }
// uploaded_time is stored as new Date(video.uploaded_at).toLocaleString()
// We re-parse via new Date() which handles locale strings reliably in the same browser
function parseVideoTime(row: any): { dateKey: string; startHour: number } | null {
  try {
    const d = new Date(row.uploaded_at);
    if (isNaN(d.getTime())) return null;
    return {
      dateKey: toDateKey(d),
      startHour: d.getHours() + d.getMinutes() / 60,
    };
  } catch {
    return null;
  }
}

// parses a duration formatted as a string to a number
function parseDurationSeconds(duration: string): number {
  if (!duration || duration === 'N/A') return 0;
  return parseInt(duration.replace(/[^0-9]/g, ''), 10) || 0;
}

// formats the time range given the start time and a the video's duration
function formatBlockTimeRange(startHour: number, durationSeconds: number): string {
  const fmt = (h: number) => {
    const totalMinutes = Math.round(h * 60);
    const hrs = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const suffix = hrs < 12 ? 'am' : 'pm';
    const displayH = hrs === 0 ? 12 : hrs > 12 ? hrs - 12 : hrs;
    return `${String(displayH).padStart(2, '0')}:${String(mins).padStart(2, '0')}${suffix}`;
  };
  const endHour = startHour + durationSeconds / 3600;
  return `${fmt(startHour)} – ${fmt(endHour)}`;
}



// --------- Calendar Card --------------

// creates a single block for the calendar to represent a video
function SessionBlock({
  row, startHour, selected, onClick, onPlay,
}: {
  row: VideoSummary;
  startHour: number;
  selected: boolean;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
}) {
  const durationSecs = row.duration_seconds;
  // minimum 45-min visual height so tiny clips are still readable
  const durationHours = Math.max(durationSecs / 3600, 0.75);
  const top = (startHour - HOUR_START) * HOUR_HEIGHT;
  const height = durationHours * HOUR_HEIGHT;
  const timeLabel = formatBlockTimeRange(startHour, durationSecs);

  const statusColor =
    row.processing_status === 'completed'  ? '#4CAF50' :
    row.processing_status === 'failed'     ? '#f44336' :
    row.processing_status === 'processing' ? '#ff9800' : '#888';

  return (
    <div
      className={`cal-block${selected ? ' cal-block--selected' : ''}`}
      style={{ top: `${top}px`, height: `${height}px` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="cal-block__header">
        <span className="cal-block__time">{timeLabel}</span>
        <button className="cal-block__play" aria-label="Play video" onClick={onPlay}>
          <PlayArrowIcon sx={{ fontSize: 13 }} />
        </button>
      </div>

      
      {/* only display if this block contains enough room to store this variable */}
      { height >= 98 && (
        <div className="cal-block__stats">
          <div className="cal-block__col">
            <span className="cal-stat">
              <DirectionsCarIcon sx={{ fontSize: 12 }} />
              <b>{row.vehicles}</b>&nbsp;vehicles
            </span>
            <span className="cal-stat cal-stat--adb">
              <ReportProblemOutlinedIcon sx={{ fontSize: 12 }} />
              <b>{row.swerving_count}</b>&nbsp;ADB
            </span>
          </div>
          <div className="cal-block__col">
            <span className="cal-stat cal-stat--adb">
              <SpeedOutlinedIcon sx={{ fontSize: 12 }} />
              <b>{row.speeding_count}</b>&nbsp;speeding
            </span>
            <span className="cal-stat cal-stat--adb">
              <SwapCallsIcon sx={{ fontSize: 12 }} />
              <b>{row.swerving_count}</b>&nbsp;swerving
            </span>
            <span className="cal-stat cal-stat--adb">
              <PanToolOutlinedIcon sx={{ fontSize: 12 }} />
              <b>{row.abrupt_stopping_count}</b>&nbsp;abrupt stopping
            </span>
          </div>
        </div>
      )}

      {/* 
      // removed temp — can we find a better spot for this?
      <span className="cal-block__status" style={{ color: statusColor }}>
        ● {row.status}
      </span>
      */}
    </div>
  );
}

// ------- Main Table -------- 

interface TableProps {
  cameraId?: number | null;                                                                 // id of the current camera
  camera?: CameraSummary | null;                                                            // Summary object of the current camera
  loadedVideos?: VideoSummary[] | null;                                                             // all the videos available to this camera as a VideoSummary object

  onVideoFileSelect: (url: string, thumbnail?: string) => void;                             // runs when the user selects a video file
  hideUpload?: boolean;                                                                     // hide the upload button?
  onUploadStart?: (videoName: string) => void;                                              // runs when user starts a video upload
  onUploadComplete?: () => void;                                                            // runs when a video upload is completed
  onProcessingStart?: (videoName: string, videoId: number) => void;                         // runs when video processing starts
  onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;         // runs when video processing has completed
  
  onVideoSelect?: (videoData: any) => void;                                                 // runs when user selects a single video
  onMultipleVideoSelect?: (videoDataArray: any[]) => void;                                  // runs when user selects multiple videos

  visibleCameraIds?: number[];                                                              // deprecated — fetch videos from all the camera ids visible from here
  externalModalOpen?: boolean;                                                              // to be deprecated — when set to true (rising edge only), displays the add video modal
  onExternalModalClose?: () => void;                                                        // to be deprecated — runs when user closes a modal
}

export default function Table({
  cameraId, camera, loadedVideos,
  onVideoFileSelect, hideUpload = false, onUploadComplete, visibleCameraIds = [], onUploadStart, onProcessingStart, onProcessingComplete, onVideoSelect, onMultipleVideoSelect, externalModalOpen, onExternalModalClose
}: TableProps) {
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
    open: false, message: '', severity: 'success'
  });

  // const [loadedVideos, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // The single selected video (calendar supports one at a time)
  const selectedRow = selectedRows.length === 1 ? selectedRows[0] : null;

  useEffect(() => {
    if (externalModalOpen) {
      setAddModalOpen(true);
      onExternalModalClose?.(); 
    }
  }, [externalModalOpen]);

  // Fetch videos for the selected camera or visible cameras on calendar view
  const fetchVideos = async () => {
    /*
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
    */
  };

  const visibleCameraIdsKey = visibleCameraIds.sort((a, b) => a - b).join(',');

  useEffect(() => {
    fetchVideos();
  }, [cameraId, visibleCameraIdsKey]);

  // Auto-jump to the date of the most recent video on first load
  useEffect(() => {
    if (loadedVideos.length === 0) return;
    const parsed = loadedVideos.map(r => parseVideoTime(r)).filter(Boolean) as { dateKey: string; startHour: number }[];
    if (parsed.length === 0) return;
    const latestKey = parsed.map(p => p.dateKey).sort().at(-1)!;
    setCurrentDate(new Date(latestKey + 'T12:00:00'));
  }, [loadedVideos]);

  // ----------------- Handlers for Add/Edit/Delete actions -----------------

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newName }),
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Video name updated successfully', severity: 'success' });
        fetchVideos();
        if (onUploadComplete) onUploadComplete();
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
      setSnackbar({ open: true, message: 'Error: No video selected for calibration edit', severity: 'error' });
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData),
        }
      );

      if (response.ok) {
        setSnackbar({ open: true, message: 'Calibration updated successfully', severity: 'success' });
        setEditCalibrationModalOpen(false);
        fetchVideos();
      } else {
        const errorData = await response.json();
        setSnackbar({ open: true, message: `Failed to update calibration: ${errorData.detail || 'Unknown error'}`, severity: 'error' });
      }
    } catch (error) {
      console.error('Error updating calibration:', error);
      setSnackbar({ open: true, message: `Error updating calibration: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const deletePromises = selectedRows.map(row =>
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${row.id}/`, { method: 'DELETE' })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedRows.length) {
        setSnackbar({ open: true, message: `Successfully deleted ${successCount} video${successCount > 1 ? 's' : ''}`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `Deleted ${successCount} of ${selectedRows.length} videos`, severity: 'warning' });
      }

      setDeleteDialogOpen(false);
      setSelectedRows([]);
      fetchVideos();
      if (onUploadComplete) onUploadComplete();
    } catch (error) {
      console.error('Error deleting videos:', error);
      setSnackbar({ open: true, message: 'Error deleting videos', severity: 'error' });
      setDeleteDialogOpen(false);
    }
  };

  // ----------- Calendar Render ----------------

  const dateKey = toDateKey(currentDate);
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const gridHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  const todayBlocks = loadedVideos
    .map(row => { const t = parseVideoTime(row); return t ? { row, ...t } : null; })
    .filter((b): b is { row: any; dateKey: string; startHour: number } => b !== null && b.dateKey === dateKey);

  return (
    <Box>
      <div className="table-container">

        {/* ----------- Calendar header --------------- */}
        <div className="cal-header">
          <div className="cal-header__nav">
            <button className="cal-nav-btn" onClick={() => setCurrentDate(d => addDays(d, -1))} aria-label="Previous day">
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </button>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                value={dayjs(currentDate)}
                onChange={(val: Dayjs | null) => { if (val && val.isValid()) setCurrentDate(val.toDate()); }}
                slotProps={{
                  textField: {
                    size: 'small',
                    inputProps: { readOnly: true },
                    sx: {
                      width: 147,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontFamily: "'Roboto Mono', 'DM Mono', monospace",
                        fontWeight: 500,
                        cursor: 'pointer',
                        '& fieldset': { borderColor: '#e0e0e0' },
                        '&:hover fieldset': { borderColor: '#bdbdbd' },
                      },
                      '& .MuiInputBase-input': { padding: '5px 4px 5px 10px', cursor: 'pointer' },
                      '& .MuiInputAdornment-root .MuiIconButton-root': { padding: '4px' },
                    },
                  },
                }}
              />
            </LocalizationProvider>
            <button className="cal-nav-btn" onClick={() => setCurrentDate(d => addDays(d, 1))} aria-label="Next day">
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </button>
          </div>

          {!hideUpload && (
            <div className="cal-header__actions">
              {/*<button className="cal-icon-btn" title="Upload video" aria-label="Upload video" onClick={() => setAddModalOpen(true)}>
                <FileUploadIcon sx={{ fontSize: 17 }} />
              </button>
               <button className="cal-icon-btn" title="Edit calibration" aria-label="Edit calibration" disabled={!selectedRow} onClick={handleEditCalibration}>
                <TuneIcon sx={{ fontSize: 17 }} />
              </button>
              <button className="cal-icon-btn" title="Rename video" aria-label="Rename video" disabled={!selectedRow} onClick={handleEdit}>
                <EditIcon sx={{ fontSize: 17 }} />
              </button> */}
              <button className="cal-icon-btn cal-icon-btn--danger" title="Delete video" aria-label="Delete video" disabled={!selectedRow} onClick={handleDelete}>
                <DeleteIcon sx={{ fontSize: 17 }} />
              </button>
            </div>
          )}
        </div>

        {/* ── Calendar grid ── */}
        <div className="cal-grid-scroll">
          {loading ? (
            <div className="cal-empty">Loading videos…</div>
          ) : (
            <div className="cal-grid">
              {/* Time labels */}
              <div className="cal-times">
                {hours.map(h => (
                  <div key={h} className="cal-time-slot" style={{ height: `${HOUR_HEIGHT}px` }}>
                    <span className="cal-time-label">{formatHourLabel(h)}</span>
                  </div>
                ))}
              </div>

              {/* Events column */}
              <div className="cal-events" style={{ height: `${gridHeight}px` }}>
                {hours.map(h => (
                  <div
                    key={h}
                    className="cal-hour-line"
                    style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px` }}
                  />
                ))}

                {todayBlocks.length === 0 && (
                  <div className="cal-empty cal-empty--inline">No videos recorded for this day</div>
                )}

                {todayBlocks.map(({ row, startHour }) => (
                  <SessionBlock
                    key={row.id}
                    row={row}
                    startHour={startHour}
                    selected={selectedRow?.id === row.id}
                    onClick={() => {
                      const newSelection = selectedRow?.id === row.id ? [] : [row];
                      setSelectedRows(newSelection);
                      if (onVideoSelect) onVideoSelect(newSelection.length ? row : null);
                    }}
                    onPlay={(e) => {
                      e.stopPropagation();
                      if (row.thumbnail) onVideoFileSelect(row.thumbnail, row.thumbnail);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ----------- Modals ------- */}
      {!hideUpload && (
        <>
          <CameraAddModal 
            open={false} 
            onClose={() => setAddModalOpen(false)} 
            onSubmit={handleAdd} 
            onVideoFileSelect={onVideoFileSelect}
            cameraId={cameraId}
            onUploadComplete={onUploadComplete}
            onUploadStart={() => {}}
            onProcessingStart={onProcessingStart}
            onProcessingComplete={onProcessingComplete}
          />
          <CameraEditModal
            open={false}
            onClose={() => setEditModalOpen(false)}
            onSubmit={handleEditSubmit}
            videoId={selectedRows.length === 1 ? selectedRows[0].id : null}
            currentName={selectedRows.length === 1 ? selectedRows[0].video_name : ''}
          />
          <CameraAddModal
            open={false}
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
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete {selectedRows.length} video{selectedRows.length > 1 ? 's' : ''}?
                This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)} color="secondary">Cancel</Button>
              <Button onClick={handleDeleteConfirm} variant="contained" color="error">Delete</Button>
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