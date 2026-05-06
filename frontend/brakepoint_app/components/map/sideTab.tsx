'use client';

import React, {useRef, useState, useEffect} from 'react';
import ToggleDrawer from './toggleDrawer';
import './sideTab.css';

type SideTabProps = {
  side: 'left' | 'right' | "top";
  open: boolean;
  invisible?: boolean;
  onToggle: () => void;
  style?: object;
  children?: React.ReactNode;
};

export default function SideTab({ side, open, invisible = false, onToggle, style = {}, children }: SideTabProps) {
  const [width, setWidth] = useState(33);
  const [height, setHeight] = useState(12);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleDrag = (e:MouseEvent) => {
      if (!isDragging.current) return;

      if (side==='left') {
        //setWidth(Math.min(Math.max(e.clientX, 480), 720));
        setWidth(33);
      }

      if (side==='right') {
        //setWidth(Math.min(Math.max(window.innerWidth - e.clientX, 480), 720));
        setWidth(33);
      }; 

      if (side==='top') {
        setHeight(10);
      }; 
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    };

  }, [side]);

  const startDrag = () => {
    isDragging.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const saved = localStorage.getItem('sideTabWidth');
    if (saved) setWidth(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('sideTabWidth', width.toString());
  }, [width]);


  return (
    <>
      <div
        className={`side-tab side-tab-${side} ${ open ? 'open' : 'closed' } ${ invisible ? "main-invisible" : "" }`}
        style={{
          width: ["left", "right"].includes(side) ? `${width}em` : "100%",
          height: ["top", "bottom"].includes(side) ? `${height}em` : "100%",
        }}
      >
        <div className="side-tab-content" style = {style}>{children}</div>

        <div
          className={`side-tab-resizer side-tab-resizer-${side}`}
          onMouseDown={startDrag}
        />
      </div>

      <ToggleDrawer side={side} open={open} invisible={invisible} onToggle={onToggle} sideTabWidth={["left", "right"].includes(side) ? width : height}/>
    </>
  );
}