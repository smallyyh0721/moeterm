import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PETDEX_ANIMATIONS, type PetdexAnimation } from '../../shared/petdex';
import type { InstalledPet, Settings } from '../../shared/types';
import { randomJoke } from '../lib/jokes';

export type PetSignal = 'idle' | 'connecting' | 'connected' | 'error';

type Action = 'idle' | 'wave' | 'jump' | 'run' | 'sit' | 'cheer' | 'fail';

const poseLoaders: Record<Action, () => Promise<{ default: string }>> = {
  idle: () => import('../assets/pet-idle.png'),
  wave: () => import('../assets/pet-wave.png'),
  jump: () => import('../assets/pet-jump.png'),
  run: () => import('../assets/pet-run.png'),
  sit: () => import('../assets/pet-sit.png'),
  cheer: () => import('../assets/pet-cheer.png'),
  fail: () => import('../assets/pet-fail.png'),
};
const poseUrl = new Map<Action, string>();
const poseTask = new Map<Action, Promise<string>>();

function loadPose(action: Action): Promise<string> {
  const ready = poseUrl.get(action);
  if (ready) return Promise.resolve(ready);
  const pending = poseTask.get(action);
  if (pending) return pending;
  const task = poseLoaders[action]().then((mod) => {
    poseUrl.set(action, mod.default);
    return mod.default;
  });
  poseTask.set(action, task);
  return task;
}

const BUILTIN_LOOP: Action[] = ['idle', 'wave', 'jump', 'run', 'cheer', 'sit', 'idle', 'wave'];

export function Pet({
  settings,
  signal,
  pet,
  onPlace,
}: {
  settings: Settings;
  signal: PetSignal;
  pet: InstalledPet | null;
  onPlace: (x: number, y: number) => void;
}) {
  const [action, setAction] = useState<Action>('idle');
  const [poseSrc, setPoseSrc] = useState<string | null>(null);
  const [burst, setBurst] = useState<PetdexAnimation | null>(null);
  const [hovered, setHovered] = useState(false);
  const [speech, setSpeech] = useState<string | null>(null);
  const [facing, setFacing] = useState(1);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const signalRef = useRef(signal);
  const loopIndex = useRef(0);
  signalRef.current = signal;

  useEffect(() => {
    if (!pet) {
      setSheetUrl(null);
      return;
    }
    let cancel = false;
    void window.moeterm.petSheet(pet.id).then((result) => {
      if (!cancel && result.ok) setSheetUrl(`data:${result.data.mime};base64,${result.data.base64}`);
    });
    return () => {
      cancel = true;
    };
  }, [pet]);

  useEffect(() => {
    if (pet) return;
    if (signal === 'connecting') {
      setAction('run');
      return;
    }
    if (signal === 'error') {
      setAction('fail');
      return;
    }
    const timer = window.setInterval(() => {
      if (drag.current || signalRef.current === 'connecting' || signalRef.current === 'error') return;
      loopIndex.current = (loopIndex.current + 1) % BUILTIN_LOOP.length;
      setAction(BUILTIN_LOOP[loopIndex.current] ?? 'idle');
    }, 2200);
    return () => window.clearInterval(timer);
  }, [pet, signal]);

  useEffect(() => {
    if (!settings.petEnabled || (pet && sheetUrl)) return;
    let cancel = false;
    void loadPose(action).then((url) => {
      if (!cancel) setPoseSrc(url);
    });
    return () => {
      cancel = true;
    };
  }, [action, pet, sheetUrl, settings.petEnabled]);

  useEffect(() => {
    if (pet || !settings.petEnabled) return;
    const prefetch = () => {
      for (const name of BUILTIN_LOOP) void loadPose(name);
    };
    const idleId = window.requestIdleCallback?.(prefetch);
    const timer = idleId === undefined ? window.setTimeout(prefetch, 600) : 0;
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer) window.clearTimeout(timer);
    };
  }, [pet, settings.petEnabled]);

  useEffect(() => {
    if (!pet) return;
    const timer = window.setInterval(() => {
      if (drag.current || signalRef.current === 'connecting' || signalRef.current === 'error') return;
      setBurst(Math.random() < 0.5 ? 'jumping' : 'waving');
      window.setTimeout(() => setBurst(null), 1400);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [pet]);

  useEffect(() => {
    if (!settings.petEnabled || settings.petX === null || settings.petY === null) return;
    const node = frameRef.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;
    const pullIntoView = () => {
      const bounds = parent.getBoundingClientRect();
      const width = node.offsetWidth || 112;
      const height = node.offsetHeight || 124;
      if (bounds.width < 80 || bounds.height < 80) return;
      const maxX = Math.max(0, bounds.width - width);
      const maxY = Math.max(0, bounds.height - height);
      const x = Math.min(Math.max(0, settings.petX ?? 0), maxX);
      const y = Math.min(Math.max(0, settings.petY ?? 0), maxY);
      if (x !== settings.petX || y !== settings.petY) onPlaceRef.current(Math.round(x), Math.round(y));
    };
    pullIntoView();
    const observer = new ResizeObserver(pullIntoView);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [settings.petEnabled, settings.petX, settings.petY]);

  if (!settings.petEnabled) return null;

  const style: CSSProperties =
    settings.petX === null || settings.petY === null ? { right: 12, bottom: 28 } : { left: settings.petX, top: settings.petY };
  const row = spriteRow(signal, hovered, burst, facing);

  return (
    <div
      ref={frameRef}
      className={`pet ${pet && sheetUrl ? 'sprite' : ''} act-${action}`}
      style={style}
      onPointerEnter={() => {
        setHovered(true);
        setSpeech(randomJoke());
      }}
      onPointerLeave={() => {
        setHovered(false);
        setSpeech(null);
      }}
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
        setSpeech(null);
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
          if (!pet) {
            loopIndex.current = (loopIndex.current + 1) % BUILTIN_LOOP.length;
            setAction(BUILTIN_LOOP[loopIndex.current] ?? 'wave');
          } else {
            setBurst('jumping');
            window.setTimeout(() => setBurst(null), 1200);
          }
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
      {pet && sheetUrl ? (
        <SpriteSheet pet={pet} sheetUrl={sheetUrl} row={row} facing={facing} />
      ) : (
        <div className="pet-bob">
          {poseSrc ? <img className={facing < 0 ? 'face-left' : ''} src={poseSrc} alt="" draggable={false} /> : null}
        </div>
      )}
    </div>
  );
}

function SpriteSheet({
  pet,
  sheetUrl,
  row,
  facing,
}: {
  pet: InstalledPet;
  sheetUrl: string;
  row: PetdexAnimation;
  facing: number;
}) {
  const animation = PETDEX_ANIMATIONS[row];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const durations = animation.durations;
    let index = 0;
    let timer = 0;
    setFrame(0);
    const tick = () => {
      index = (index + 1) % durations.length;
      setFrame(index);
      timer = window.setTimeout(tick, durations[index] ?? 140);
    };
    timer = window.setTimeout(tick, durations[0] ?? 140);
    return () => window.clearTimeout(timer);
  }, [animation, row]);

  const scale = 112 / pet.frameWidth;
  const width = pet.frameWidth * scale;
  const height = pet.frameHeight * scale;
  return (
    <div
      className={facing < 0 ? 'pet-sprite face-left' : 'pet-sprite'}
      style={{
        width,
        height,
        backgroundImage: `url("${sheetUrl}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${-frame * width}px ${-animation.row * height}px`,
        backgroundSize: `${width * 8}px ${height * pet.rows}px`,
      }}
    />
  );
}

function spriteRow(signal: PetSignal, hovered: boolean, burst: PetdexAnimation | null, facing: number): PetdexAnimation {
  if (signal === 'connecting') return facing < 0 ? 'running-left' : 'running-right';
  if (signal === 'error') return 'failed';
  if (hovered) return 'waving';
  if (burst) return burst;
  return 'idle';
}
