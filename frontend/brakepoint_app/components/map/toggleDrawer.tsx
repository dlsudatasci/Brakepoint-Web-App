'use client';

import React, { useEffect, useState } from 'react';
import {KeyboardArrowUp, KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import './toggleDrawer.css';

type ToggleDrawerProps = {
  side: 'top' | 'bottom' | 'left' | 'right';
  open: boolean;
  invisible: boolean;
  onToggle: () => void;
  sideTabWidth?: number;
};

export default function ({side, open, invisible = false, onToggle, sideTabWidth}: ToggleDrawerProps) {
  const [translate, setTranslate] = useState(open ? sideTabWidth : 0);

  useEffect(() => {
    if (open) setTranslate(sideTabWidth);
    else setTranslate(0);
  }, [open, sideTabWidth]);

  const icon = {
        top: open ? <KeyboardArrowUp /> : <KeyboardArrowDown />,
        bottom: open ? <KeyboardArrowDown /> : <KeyboardArrowUp />,
        left: open ? <KeyboardArrowLeft /> : <KeyboardArrowRight />,
        right: open ? <KeyboardArrowRight /> : <KeyboardArrowLeft />,
    }[side];

  const sideClass = `toggle-${side}`;

  const style =
    side === 'left'
      ? { transform: `translateX(${translate/1.5}em) translateY(-50%)` }
      : side === 'right'
      ? { transform: `translateX(-${translate/1.5}em) translateY(-50%)` }
      : side === 'top'
      ? { transform: `translateX(-50%) translateY(${translate/1.5}em)` }
      : side === 'bottom'
      ? { transform: `translateX(-50%) translateY(-${translate/1.5}em)` }
      : {};


    return (
    <IconButton
      className={`toggle-button toggle-${side} ${invisible ? "main-invisible" : ""}`}
      onClick={onToggle}
      style={style}
    >
      {icon}
    </IconButton>
  );

}
