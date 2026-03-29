import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// Connect to the Live Backend URL
const socket = io('https://deepwork-backend.onrender.com');

const MODES = {
  focus:      { label: 'Focus',       duration: 25 * 60, color: '#6366f1' },
  shortBreak: { label: 'Short Break', duration: 5 * 60,  color: '#10b981' },
  longBreak:  { label: 'Long Break',  duration: 15 * 60, color: '#f59e0b' },
};

function App() {
  const [mode, setMode]                   = useState('focus');
  const [customDurations, setCustomDurations] = useState({
    focus: MODES.focus.duration,
    shortBreak: MODES.shortBreak.duration,
    longBreak: MODES.longBreak.duration,
  });
  const [timeLeft, setTimeLeft]           = useState(MODES.focus.duration);
  const [isActive, setIsActive]           = useState(false);
  const [roomId, setRoomId]               = useState('');
  const [inRoom, setInRoom]               = useState(false);
  const [sessions, setSessions]           = useState(0);

  // Custom timer editing
  const [isEditing, setIsEditing]         = useState(false);
  const [editValue, setEditValue]         = useState('');
  const inputRef                          = useRef(null);

  const currentMode     = MODES[mode];
  const currentDuration = customDurations[mode];

  // Reset timer when mode changes
  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setIsActive(false);
    setIsEditing(false);
    setTimeLeft(customDurations[newMode] ?? MODES[newMode].duration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDurations]);

  // Socket: receive timer actions from room peers
  useEffect(() => {
    socket.on('timer_action', (data) => {
      const { action, timeLeft: newTimeLeft, mode: newMode } = data;
      if (newMode && MODES[newMode]) {
        setMode(newMode);
        setTimeLeft(newTimeLeft ?? MODES[newMode].duration);
      }
      if (action === 'start') {
        if (newTimeLeft !== undefined) setTimeLeft(newTimeLeft);
        setIsActive(true);
      } else if (action === 'pause') {
        if (newTimeLeft !== undefined) setTimeLeft(newTimeLeft);
        setIsActive(false);
      } else if (action === 'reset') {
        setTimeLeft(newMode ? MODES[newMode].duration : currentDuration);
        setIsActive(false);
      }
    });
    return () => socket.off('timer_action');
  }, [currentDuration]);

  // Local countdown tick
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      if (mode === 'focus') setSessions(s => s + 1);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  // ── Custom timer handlers ──────────────────────────────────────────────────

  const startEditing = () => {
    if (isActive) return; // Don't allow editing while running
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    setEditValue(`${m}:${s}`);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    // Accept formats: "25", "25:00", "1:30:00" (h:mm:ss), "90" (minutes)
    const raw = editValue.trim();
    let totalSeconds = 0;

    const parts = raw.split(':').map(Number);
    if (parts.some(isNaN)) {
      // Bad input — revert
      return;
    }
    if (parts.length === 1) {
      // Plain number → treat as minutes
      totalSeconds = parts[0] * 60;
    } else if (parts.length === 2) {
      // MM:SS
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    totalSeconds = Math.max(10, Math.min(totalSeconds, 99 * 60 + 59)); // clamp 10s–99:59
    setCustomDurations(prev => ({ ...prev, [mode]: totalSeconds }));
    setTimeLeft(totalSeconds);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  // ── Timer actions ──────────────────────────────────────────────────────────

  const toggleTimer = () => {
    const newIsActive = !isActive;
    setIsActive(newIsActive);
    if (inRoom) {
      socket.emit('timer_action', { roomId, action: newIsActive ? 'start' : 'pause', timeLeft, mode });
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(currentDuration);
    if (inRoom) {
      socket.emit('timer_action', { roomId, action: 'reset', timeLeft: currentDuration, mode });
    }
  };

  const joinRoom = () => {
    if (roomId.trim() !== '') {
      socket.emit('join_room', roomId);
      setInRoom(true);
    }
  };

  const leaveRoom = () => {
    socket.emit('leave_room', roomId);
    setInRoom(false);
    setRoomId('');
  };

  // Window controls via electronAPI (exposed via preload)
  const closeWindow    = () => window.electronAPI?.closeWindow?.();
  const minimizeWindow = () => window.electronAPI?.minimizeWindow?.();

  // ── Display values ─────────────────────────────────────────────────────────

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  const progress         = ((currentDuration - timeLeft) / currentDuration) * 100;
  const radius           = 46;
  const circumference    = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-screen h-screen bg-[#18181b]/95 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-5 border border-white/8 shadow-2xl relative overflow-hidden select-none">

      {/* Background ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 blur-3xl rounded-full pointer-events-none opacity-25 transition-colors duration-700"
        style={{ backgroundColor: currentMode.color }}
      />

      {/* Title bar / drag region */}
      <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-3 pt-1">
        <span className="text-white/30 text-[10px] tracking-widest uppercase font-semibold">DeepWork</span>
        <div className="flex items-center gap-1.5">
          <button onClick={minimizeWindow} className="clickable w-3 h-3 rounded-full bg-white/10 hover:bg-yellow-400 transition-colors" title="Minimize" />
          <button onClick={closeWindow}    className="clickable w-3 h-3 rounded-full bg-white/10 hover:bg-red-500 transition-colors"    title="Close" />
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="z-10 flex bg-white/5 rounded-lg p-0.5 gap-0.5 mb-4 mt-3">
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className={`clickable text-[10px] font-medium px-2.5 py-1 rounded-md transition-all duration-200 ${
              mode === key ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
            style={mode === key ? { backgroundColor: m.color + '33', color: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Room Connection Bar */}
      <div className="z-10 w-full px-1 mb-3 flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          {sessions > 0 && (
            <div className="flex items-center gap-1 text-white/40 text-[10px]">
              {Array.from({ length: Math.min(sessions, 4) }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500/70 inline-block" />
              ))}
              {sessions > 4 && <span className="text-[9px]">+{sessions - 4}</span>}
            </div>
          )}
        </div>
        {!inRoom ? (
          <div className="flex bg-white/5 rounded-md border border-white/8 overflow-hidden">
            <input
              type="text" placeholder="Room Code" value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              className="clickable bg-transparent text-white text-[10px] px-2 py-1 w-20 outline-none placeholder:text-white/25"
            />
            <button onClick={joinRoom} className="clickable bg-indigo-500/80 hover:bg-indigo-500 text-white text-[10px] px-2 py-1 transition-colors">
              Join
            </button>
          </div>
        ) : (
          <button onClick={leaveRoom} className="clickable text-emerald-400 text-[10px] flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {roomId}
          </button>
        )}
      </div>

      {/* Timer Ring */}
      <div className="relative flex items-center justify-center w-44 h-44 mb-5">
        <svg className="absolute w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
          <circle
            cx="50" cy="50" r={radius}
            fill="transparent"
            stroke={currentMode.color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        <div className="flex flex-col items-center z-10">
          {/* Clickable / editable time display */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              className="clickable w-32 text-center text-5xl font-light tracking-tight text-white font-mono bg-transparent outline-none border-b border-white/30 pb-0.5 caret-white"
              maxLength={8}
            />
          ) : (
            <button
              onClick={startEditing}
              title={isActive ? 'Pause to edit time' : 'Click to set custom time'}
              className={`clickable text-5xl font-light tracking-tight text-white font-mono transition-opacity ${
                isActive ? 'cursor-default' : 'hover:opacity-70 cursor-text'
              }`}
            >
              {minutes}:{seconds}
            </button>
          )}

          <div
            className="text-[10px] font-medium mt-1.5 tracking-wider uppercase transition-colors duration-500"
            style={{ color: currentMode.color + 'cc' }}
          >
            {isEditing
              ? 'set time (mm:ss)'
              : isActive
                ? (mode === 'focus' ? 'Focusing...' : 'On break...')
                : !isActive && timeLeft !== currentDuration
                  ? 'paused'
                  : currentMode.label
            }
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 z-10">
        <button
          onClick={resetTimer}
          className="clickable flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all border border-white/5"
          title="Reset"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={toggleTimer}
          className={`clickable flex items-center justify-center w-28 h-10 rounded-full font-medium text-sm transition-all shadow-lg border ${
            isActive
              ? 'bg-white/8 text-white/70 border-white/10 hover:bg-white/12'
              : 'text-white border-transparent shadow-xl'
          }`}
          style={!isActive ? {
            backgroundColor: currentMode.color,
            boxShadow: `0 8px 24px ${currentMode.color}44`,
          } : {}}
        >
          {isActive ? 'Pause' : 'Start'}
        </button>

        {/* Skip to next mode */}
        <button
          onClick={() => {
            const order = ['focus', 'shortBreak', 'focus', 'longBreak'];
            const idx = order.indexOf(mode);
            switchMode(order[(idx + 1) % order.length]);
          }}
          className="clickable flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all border border-white/5"
          title="Skip"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Session dots label */}
      {sessions > 0 && (
        <div className="z-10 mt-3 text-white/25 text-[9px] tracking-widest uppercase">
          {sessions} session{sessions !== 1 ? 's' : ''} completed
        </div>
      )}
    </div>
  );
}

export default App;
