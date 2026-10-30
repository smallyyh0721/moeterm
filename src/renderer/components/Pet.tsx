import { useEffect, useRef, useState, type CSSProperties } from 'react';
import idleUrl from '../assets/pet-idle.png';
import waveUrl from '../assets/pet-wave.png';
import jumpUrl from '../assets/pet-jump.png';
import runUrl from '../assets/pet-run.png';
import sitUrl from '../assets/pet-sit.png';
import cheerUrl from '../assets/pet-cheer.png';
import failUrl from '../assets/pet-fail.png';
import type { Settings } from '../../shared/types';

export type PetSignal = 'idle' | 'connecting' | 'connected' | 'error';

type Action = 'idle' | 'wave' | 'jump' | 'run' | 'sit' | 'cheer' | 'fail';

const POSES: Record<Action, string> = {
  idle: idleUrl,
  wave: waveUrl,
  jump: jumpUrl,
  run: runUrl,
  sit: sitUrl,
  cheer: cheerUrl,
  fail: failUrl,
};

const LINES: Record<Action, string[]> = {
  idle: ['我在这儿看着终端。', '点我一下，我换个姿势。'],
  wave: ['嗨，要连哪一台？', '挥挥手，会话还在。'],
  jump: ['连上啦！', '跳一下，当是庆祝。'],
  run: ['我跟着你跑。', '连接中，先热热身。'],
  sit: ['先坐一会儿。', '没动静的话，我就打个盹。'],
  cheer: ['漂亮，这条通了。', '日志、密钥，我都帮你记着。'],
  fail: ['这次没连上……', '再试一次？我在。'],
};

const PLAY: Action[] = ['wave', 'jump', 'cheer', 'sit', 'run'];

export function Pet({
  settings,
  signal,
  onPlace,
}: {
  settings: Settings;
  signal: PetSignal;
  onPlace: (x: number, y: number) => void;
}) {
  const [action, setAction] = useState<Action>('idle');
  const [speech, setSpeech] = useState<string | null>(null);
  const [facing, setFacing] = useState(1);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const back = useRef<number | null>(null);
  const signalRef = useRef(signal);
  signalRef.current = signal;

  const say = (next: Action) => {
    const lines = LINES[next];
    setSpeech(lines[Math.floor(Math.random() * lines.length)] ?? lines[0]);
    window.setTimeout(() => setSpeech(null), 2400);
  };

  const play = (next: Action, hold = 1700) => {
    setAction(next);
    if (back.current) window.clearTimeout(back.current);
    if (next === 'idle' || next === 'run' && signalRef.current === 'connecting') return;
    back.current = window.setTimeout(() => {
      setAction(signalRef.current === 'connecting' ? 'run' : 'idle');
    }, hold);
  };

  useEffect(() => {
    if (signal === 'connecting') play('run', 20000);
    else if (signal === 'error') play('fail', 2400);
    else if (signal === 'connected') play('cheer', 1800);
    else play('idle');
  }, [signal]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (drag.current || signalRef.current === 'connecting' || signalRef.current === 'error') return;
      const next = PLAY[Math.floor(Math.random() * PLAY.length)] ?? 'wave';
      play(next, next === 'sit' ? 4200 : 1800);
    }, 12000);
    return () => window.clearInterval(timer);
  }, []);

  if (!settings.petEnabled) return null;

  const style: CSSProperties =
    settings.petX === null || settings.petY === null ? { right: 12, bottom: 28 } : { left: settings.petX, top: settings.petY };

  return (
    <div
      className={`pet act-${action}`}
      style={style}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const info = drag.current;
        if (!info) return;
        const dx = event.clientX - info.x;
        const dy = event.clientY - info.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) info.moved = true;
        if (!info.moved) return;
        if (dx > 2) setFacing(1);
        else if (dx < -2) setFacing(-1);
        setAction('run');
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
          const next = PLAY[Math.floor(Math.random() * PLAY.length)] ?? 'wave';
          play(next, next === 'sit' ? 3200 : 1600);
          say(next);
          return;
        }
        const parent = event.currentTarget.parentElement;
        if (!parent) return;
        const bounds = parent.getBoundingClientRect();
        const rect = event.currentTarget.getBoundingClientRect();
        onPlace(Math.round(rect.left - bounds.left), Math.round(rect.top - bounds.top));
        play(signalRef.current === 'connecting' ? 'run' : 'idle');
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        const order: Action[] = ['idle', 'wave', 'jump', 'run', 'cheer', 'sit', 'fail'];
        const next = order[(order.indexOf(action) + 1) % order.length] ?? 'wave';
        play(next, next === 'sit' ? 3600 : 1800);
        say(next);
      }}
    >
      {speech ? <div className="pet-bubble">{speech}</div> : null}
      <div className="pet-bob">
        <img className={facing < 0 ? 'face-left' : ''} src={POSES[action]} alt="" draggable={false} />
      </div>
    </div>
  );
}
