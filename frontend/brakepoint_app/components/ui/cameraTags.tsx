'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Chip, Typography, TextField, IconButton, Autocomplete,
  Collapse, Tooltip, Button, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { authFetch } from '@/lib/authFetch';

// Pre-coded choices based on the traffic sign model classes
const SIGN_TAG_PRESETS = [
  'Direction Sign',
  'Stop Sign',
  'Pedestrian Sign',
  'Dangerous Road Sign',
  'No Turn Sign',
  '10kph Speed Limit',
  '15kph Speed Limit',
  '20kph Speed Limit',
  '25kph Speed Limit',
  '30kph Speed Limit',
  '40kph Speed Limit',
  '50kph Speed Limit',
  '60kph Speed Limit',
  '80kph Speed Limit',
  '100kph Speed Limit',
];

// Colors for visual distinction
function tagColor(tag: string): string {
  if (tag.includes('Speed Limit')) return '#1565c0';
  if (tag === 'Stop Sign') return '#c62828';
  if (tag === 'Pedestrian Sign') return '#2e7d32';
  if (tag === 'Dangerous Road Sign') return '#e65100';
  if (tag === 'No Turn Sign') return '#6a1b9a';
  if (tag === 'Direction Sign') return '#00838f';
  return '#455a64'; // custom tags
}

function isSpeedTag(tag: string): boolean {
  return /speed\s*limit/i.test(tag);
}

interface CameraTagsProps {
  cameraId: number | null;
  compact?: boolean; 
}

export default function CameraTags({ cameraId, compact = false }: CameraTagsProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [suggestedFeatures, setSuggestedFeatures] = useState<string[]>([]);
  const [detectError, setDetectError] = useState<string | null>(null);

  useEffect(() => {
    if (!cameraId) {
      setTags([]);
      return;
    }

    setLoading(true);
    authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/tags/`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setTags(data.tags || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cameraId]);

  const saveTags = useCallback(async (newTags: string[]) => {
    if (!cameraId) return;

    setSaving(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/tags/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: newTags }),
      });
      const data = await res.json();
      if (data.success) setTags(data.tags);
    } catch {}
    setSaving(false);
  }, [cameraId]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    // Enforce single speed limit tag: remove existing speed tag when adding a new one
    let base = tags;
    if (isSpeedTag(trimmed)) {
      base = tags.filter(t => !isSpeedTag(t));
    }
    const updated = [...base, trimmed];
    setTags(updated);
    saveTags(updated);
    setInputValue('');
  }, [tags, saveTags]);

  const removeTag = useCallback((tag: string) => {
    const updated = tags.filter(t => t !== tag);
    setTags(updated);
    saveTags(updated);
  }, [tags, saveTags]);

  const detectFromLatestVideo = useCallback(async () => {
    if (!cameraId) return;
    setDetecting(true);
    setDetectError(null);
    setSuggestedFeatures([]);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/detect-road-features/`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!data.success) {
        setDetectError(data.error ?? 'Detection failed');
        return;
      }
      const newSuggestions = (data.road_features as string[]).filter(f => !tags.includes(f));
      if (newSuggestions.length === 0) {
        setDetectError('No new road features detected in this frame');
      } else {
        setSuggestedFeatures(newSuggestions);
      }
    } catch {
      setDetectError('Detection request failed');
    } finally {
      setDetecting(false);
    }
  }, [cameraId, tags]);

  const addSuggested = useCallback((feature: string) => {
    addTag(feature);
    setSuggestedFeatures(prev => prev.filter(f => f !== feature));
  }, [addTag]);

  const addAllSuggested = useCallback(() => {
    const toAdd = suggestedFeatures.filter(f => !tags.includes(f));
    if (!toAdd.length) return;
    let base = tags;
    const newSpeedTag = toAdd.find(f => isSpeedTag(f));
    if (newSpeedTag) base = base.filter(t => !isSpeedTag(t));
    const updated = [...base, ...toAdd];
    setTags(updated);
    saveTags(updated);
    setSuggestedFeatures([]);
  }, [suggestedFeatures, tags, saveTags]);

  const availablePresets = SIGN_TAG_PRESETS.filter(p => !tags.includes(p));

  if (!cameraId) return null;

  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {tags.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No tags</Typography>
        ) : tags.map(tag => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            sx={{
              bgcolor: tagColor(tag),
              color: '#fff',
              fontSize: '0.7rem',
              height: 22,
              '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
            }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      {/* Header row */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          py: 0.5,
          '&:hover': { opacity: 0.8 },
        }}
      >
        <LocalOfferIcon sx={{ fontSize: 18, color: '#455a64' }} />
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600, fontSize: '1.3rem' }}>
          Road Features
          {tags.length > 0 && (
            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
              ({tags.length})
            </Typography>
          )}
        </Typography>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </Box>

      {/* Current tags */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: expanded ? 1 : 0 }}>
        {tags.length === 0 && !expanded && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            Click to add road features
          </Typography>
        )}
        {tags.map(tag => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            onDelete={() => removeTag(tag)}
            sx={{
              bgcolor: tagColor(tag),
              color: '#fff',
              fontSize: '0.75rem',
              height: 24,
              '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
              '& .MuiChip-deleteIcon:hover': { color: '#fff' },
            }}
          />
        ))}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1 }}>
          <Autocomplete
            freeSolo
            size="small"
            options={availablePresets}
            inputValue={inputValue}
            onInputChange={(_, val) => setInputValue(val)}
            onChange={(_, val) => {
              if (typeof val === 'string' && val.trim()) {
                addTag(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault();
                addTag(inputValue);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search or type custom tag…"
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                  },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {params.InputProps.endAdornment}
                      <Tooltip title="Add tag">
                        <IconButton
                          size="small"
                          onClick={() => { if (inputValue.trim()) addTag(inputValue); }}
                          sx={{ p: 0.25 }}
                        >
                          <AddIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                <Chip
                  label={option}
                  size="small"
                  sx={{
                    bgcolor: tagColor(option),
                    color: '#fff',
                    fontSize: '0.75rem',
                    height: 22,
                    mr: 1,
                  }}
                />
                {option}
              </li>
            )}
          />

          {availablePresets.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Road feature presets:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {availablePresets.slice(0, 8).map(preset => (
                  <Chip
                    key={preset}
                    label={preset}
                    size="small"
                    variant="outlined"
                    onClick={() => addTag(preset)}
                    sx={{
                      fontSize: '0.7rem',
                      height: 24,
                      borderColor: tagColor(preset),
                      color: tagColor(preset),
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: tagColor(preset),
                        color: '#fff',
                      },
                    }}
                  />
                ))}
                {availablePresets.length > 8 && (
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    +{availablePresets.length - 8} more in search
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Auto-detect from latest video */}
          <Box sx={{ mt: 1.5, borderTop: '1px solid #eee', pt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Tooltip title="Run Mask R-CNN on the first frame of the most recently uploaded video to auto-detect road features">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={detecting ? <CircularProgress size={13} /> : <AutoFixHighIcon sx={{ fontSize: 15 }} />}
                    disabled={detecting}
                    onClick={detectFromLatestVideo}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      borderColor: '#455a64',
                      color: '#455a64',
                      '&:hover': { borderColor: '#1d1f3f', color: '#1d1f3f' },
                    }}
                  >
                    {detecting ? 'Detecting…' : 'Auto-detect from latest video'}
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {detectError && (
              <Typography variant="caption" sx={{ color: '#b71c1c', fontStyle: 'italic', display: 'block', mt: 0.25 }}>
                {detectError}
              </Typography>
            )}

            {suggestedFeatures.length > 0 && (
              <Box sx={{ mt: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Detected — click to add:
                  </Typography>
                  <Button
                    size="small"
                    onClick={addAllSuggested}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', p: '1px 6px', minWidth: 0 }}
                  >
                    Add All
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {suggestedFeatures.map(feat => (
                    <Chip
                      key={feat}
                      label={feat}
                      size="small"
                      onClick={() => addSuggested(feat)}
                      icon={<AddIcon sx={{ fontSize: '13px !important' }} />}
                      sx={{
                        fontSize: '0.7rem',
                        height: 24,
                        bgcolor: '#e8f5e9',
                        color: '#2e7d32',
                        border: '1px dashed #2e7d32',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#c8e6c9' },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {/* Speed tag hint */}
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#1565c0', fontStyle: 'italic' }}>
            💡 Speed Limit tags set the speeding threshold for this camera. Only one speed limit can be active at a time.
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}
