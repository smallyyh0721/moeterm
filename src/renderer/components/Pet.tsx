import { useRef, useState, type CSSProperties } from 'react';
import petUrl from '../assets/pet.png';
import type { Settings } from '../../shared/types';

const LINES = [
  '密钥都收在同一个数据目录里了。',
  '目录上的「全部」，可以一次连上。',
  '右键选中的输出，就能存成 txt。',
  '日志开关在上面，开了就会记下来。',
  '要传文件的话，点那台机器的 SFTP。',
];

export function Pet({ settings, onPlace }: { settings: Settings; onPlace: (x: number, y: number) => void }) {
  const [speech, setSpeech] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  if (!settings.petEnabled) return null;

  const style: CSSProperties =
    settings.petX === null || settings.petY === null ? { right: 16, bottom: 32 } : { left: settings.petX, top: settings.petY };

  return (
    <div
      className="pet"
      style={style}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const info = drag.current;
        if (!info) return;
        if (Math.abs(event.clientX - info.x) > 4 || Math.abs(event.clientY - info.y) > 4) info.moved = true;
        if (!info.moved) return;
        const parent = event.currentTarget.parentElement;
        if (!parent) return;
        const bounds = parent.getBoundingClientRect();
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(bounds.width - rect.width, event.clientX - bounds.left - (info.x - rect.left)));
        const y = Math.max(0, Math.min(bounds.height - rect.height, event.clientY - bounds.top - (info.y - rect.top)));
        info.x = event.clientX;
        info.y = event.clientY;
        event.currentTarget.style.left = `${x}px`;
        event.currentTarget.style.top = `${y}px`;
        event.currentTarget.style.right = 'auto';
        event.currentTarget.style.bottom = 'auto';
      }}
      onPointerUp={(event) => {
        const info = drag.current;
        drag.current = null;
        if (!info?.moved) {
          setSpeech(LINES[Math.floor(Math.random() * LINES.length)] ?? LINES[0]);
          window.setTimeout(() => setSpeech(null), 2600);
          return;
        }
        const parent = event.currentTarget.parentElement;
        if (!parent) return;
        const bounds = parent.getBoundingClientRect();
        const rect = event.currentTarget.getBoundingClientRect();
        onPlace(Math.round(rect.left - bounds.left), Math.round(rect.top - bounds.top));
      }}
    >
      {speech ? <div className="pet-bubble">{speech}</div> : null}
      <img src={petUrl} alt="" draggable={false} />
    </div>
  );
}
