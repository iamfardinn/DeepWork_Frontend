import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://deepwork-backend.onrender.com');

const MODES = {
  focus:      { label: 'Focus',       duration: 25 * 60, color: '#6366f1' },
  shortBreak: { label: 'Short Break', duration: 5 * 60,  color: '#10b981' },
  longBreak:  { label: 'Long Break',  duration: 15 * 60, color: '#f59e0b' },
};

function App() {
  const [mode, setMode]                     = useState('focus');
  const [customDurations, setCustomDurations] = useState({
    focus: MODES.focus.duration,
    shortBreak: MODES.shortBreak.duration,
    longBreak: MODES.longBreak.duration,
  });
  const [timeLeft, setTimeLeft]             = useState(MODES.focus.duration);
  const [isActive, setIsActive]             = useState(false);
  const [sessions, setSessions]             = useState(0);

  // Room state
  const [roomId, setRoomId]                 = useState('');
  const [roomInput, setRoomInput]           = useState('');
  const [inRoom, setInRoom]                 = useState(false);
  const [isCreator, setIsCreator]           = useState(false);
  const [roomMode, setRoomMode]             = useState('shared'); // 'shared' | 'boss'
  const [createMode, setCreateMode]         = useState('shared'); // UI selection
  const [roomError, setRoomError]           = useState('');
  const [roomPanel, setRoomPanel]           = useState(false); // expanded panel

  // Custom timer editing
  const [isEditing, setIsEditing]           = useState(false);
  const [editValue, setEditValue]           = useState('');
  const inputRef                            = useRef(null);

  const currentMode     = MODES[mode];
  const currentDuration = customDurations[mode];

  // Can this user control the timer?
  const canControl = !inRoom || roomMode === 'shared' || isCreator;

  // ── Mode switching ─────────────────────────────────────────────────────────
  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setIsActive(false);
    setIsEditing(false);
    setTimeLeft(customDurations[newMode] ?? MODES[newMode].duration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDurations]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Server confirms room join with role + mode
    socket.on('room_joined', ({ isCreator: ic, roomMode: rm }) => {
      setIsCreator(ic);
      setRoomMode(rm);
      setInRoom(true);
      setRoomError('');
      setRoomPanel(false);
    });

    socket.on('room_error', (msg) => {
      setRoomError(msg);
    });

    socket.on('room_dissolved', (msg) => {
      setRoomError(msg);
      setInRoom(false);
      setIsCreator(false);
      setRoomId('');
      setRoomInput('');
    });

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

    return () => {
      socket.off('room_joined');
      socket.off('room_error');
      socket.off('room_dissolved');
      socket.off('timer_action');
    };
  }, [currentDuration]);

  // ── Countdown ─────────────────────────────────────────────────────────────
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

  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.select();
  }, [isEditing]);

  // ── Room actions ───────────────────────────────────────────────────────────
  const createRoom = () => {
    const id = roomInput.trim();
    if (!id) return;
    setRoomId(id);
    setRoomError('');
    socket.emit('create_room', { roomId: id, roomMode: createMode });
  };

  const joinRoom = () => {
    const id = roomInput.trim();
    if (!id) return;
    setRoomId(id);
    setRoomError('');
    socket.emit('join_room', id);
  };

  const leaveRoom = () => {
    socket.emit('leave_room', roomId);
    setInRoom(false);
    setIsCreator(false);
    setRoomId('');
    setRoomInput('');
    setRoomPanel(false);
    setRoomError('');
  };

  // ── Timer actions ──────────────────────────────────────────────────────────
  const toggleTimer = () => {
    if (!canControl) return;
    const newIsActive = !isActive;
    setIsActive(newIsActive);
    if (inRoom) {
      socket.emit('timer_action', { roomId, action: newIsActive ? 'start' : 'pause', timeLeft, mode });
    }
  };

  const resetTimer = () => {
    if (!canControl) return;
    setIsActive(false);
    setTimeLeft(currentDuration);
    if (inRoom) {
      socket.emit('timer_action', { roomId, action: 'reset', timeLeft: currentDuration, mode });
    }
  };

  const handleSwitchMode = (newMode) => {
    if (!canControl) return;
    switchMode(newMode);
    if (inRoom) {
      socket.emit('timer_action', { roomId, action: 'reset', timeLeft: customDurations[newMode], mode: newMode });
    }
  };

  const handleSkip = () => {
    if (!canControl) return;
    const order = ['focus', 'shortBreak', 'focus', 'longBreak'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    handleSwitchMode(next);
  };

  // ── Custom timer edit ──────────────────────────────────────────────────────
  const startEditing = () => {
    if (isActive || !canControl) return;
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    setEditValue(`${m}:${s}`);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const raw = editValue.trim();
    const parts = raw.split(':').map(Number);
    if (parts.some(isNaN)) return;
    let totalSeconds = 0;
    if (parts.length === 1) totalSeconds = parts[0] * 60;
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    totalSeconds = Math.max(10, Math.min(totalSeconds, 99 * 60 + 59));
    setCustomDurations(prev => ({ ...prev, [mode]: totalSeconds }));
    setTimeLeft(totalSeconds);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  // Window controls
  const closeWindow    = () => window.electronAPI?.closeWindow?.();
  const minimizeWindow = () => window.electronAPI?.minimizeWindow?.();

  // ── Display ────────────────────────────────────────────────────────────────
  const minutes          = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds          = (timeLeft % 60).toString().padStart(2, '0');
  const progress         = ((currentDuration - timeLeft) / currentDuration) * 100;
  const radius           = 46;
  const circumference    = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const isBossRoom   = roomMode === 'boss';
  const isSpectator  = inRoom && isBossRoom && !isCreator;

  return (
    <div className="w-screen h-screen bg-[#18181b]/95 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-5 border border-white/8 shadow-2xl relative overflow-hidden select-none">

      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 blur-3xl rounded-full pointer-events-none opacity-25 transition-colors duration-700"
        style={{ backgroundColor: isSpectator ? '#64748b' : currentMode.color }}
      />

      {/* Title bar */}
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
            onClick={() => handleSwitchMode(key)}
            disabled={!canControl}
            className={`clickable text-[10px] font-medium px-2.5 py-1 rounded-md transition-all duration-200 ${
              !canControl ? 'opacity-40 cursor-not-allowed' : ''
            } ${mode === key ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            style={mode === key ? { backgroundColor: m.color + '33', color: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Room Bar */}
      <div className="z-10 w-full px-1 mb-3">
        {!inRoom ? (
          /* ── Not in room: compact create/join panel ── */
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                placeholder="Room code..."
                value={roomInput}
                onChange={(e) => { setRoomInput(e.target.value); setRoomError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                className="clickable flex-1 bg-white/5 border border-white/8 rounded-md text-white text-[10px] px-2 py-1.5 outline-none placeholder:text-white/20"
              />
              <button
                onClick={joinRoom}
                className="clickable bg-white/8 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white text-[10px] px-2.5 py-1.5 rounded-md transition-all"
              >
                Join
              </button>
            </div>

            {/* Create row with mode toggle */}
            <div className="flex gap-1.5 items-center">
              {/* Shared / Boss toggle */}
              <div className="flex bg-white/5 rounded-md border border-white/8 overflow-hidden text-[10px]">
                <button
                  onClick={() => setCreateMode('shared')}
                  className={`clickable px-2 py-1 transition-colors ${createMode === 'shared' ? 'bg-indigo-500/30 text-indigo-300' : 'text-white/30 hover:text-white/60'}`}
                  title="Shared — everyone controls"
                >
                  🤝 Shared
                </button>
                <button
                  onClick={() => setCreateMode('boss')}
                  className={`clickable px-2 py-1 transition-colors ${createMode === 'boss' ? 'bg-amber-500/30 text-amber-300' : 'text-white/30 hover:text-white/60'}`}
                  title="Boss — only you control"
                >
                  👔 Boss
                </button>
              </div>
              <button
                onClick={createRoom}
                className={`clickable flex-1 text-[10px] px-2.5 py-1.5 rounded-md transition-all border font-medium ${
                  createMode === 'boss'
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30'
                }`}
              >
                + Create
              </button>
            </div>

            {roomError && (
              <p className="text-red-400 text-[9px] text-center">{roomError}</p>
            )}
          </div>
        ) : (
          /* ── In room: status badge ── */
          <div className="flex items-center justify-between">
            {/* Session dots */}
            <div className="flex items-center gap-1">
              {sessions > 0 && Array.from({ length: Math.min(sessions, 4) }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500/70 inline-block" />
              ))}
              {sessions > 4 && <span className="text-white/30 text-[9px]">+{sessions - 4}</span>}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Role + mode badge */}
              <div className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                isBossRoom
                  ? isCreator
                    ? 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                    : 'bg-slate-500/15 border-slate-500/25 text-slate-400'
                  : 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
              }`}>
                {isBossRoom ? (isCreator ? '👔 Host' : '👁 Spectator') : '🤝 Shared'}
              </div>

              {/* Room code + leave */}
              <button
                onClick={leaveRoom}
                className="clickable text-white/50 hover:text-white/80 text-[10px] flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/8 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {roomId}
                <span className="text-white/25">✕</span>
              </button>
            </div>
          </div>
        )}

        {/* Room dissolved error */}
        {inRoom && roomError && (
          <p className="text-red-400 text-[9px] text-center mt-1">{roomError}</p>
        )}
      </div>

      {/* Timer Ring */}
      <div className="relative flex items-center justify-center w-44 h-44 mb-5">
        <svg className="absolute w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
          <circle
            cx="50" cy="50" r={radius}
            fill="transparent"
            stroke={isSpectator ? '#475569' : currentMode.color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        <div className="flex flex-col items-center z-10">
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
              title={!canControl ? 'Only the host can change the timer' : isActive ? 'Pause to edit time' : 'Click to set custom time'}
              className={`clickable text-5xl font-light tracking-tight font-mono transition-opacity ${
                isSpectator ? 'text-slate-400 cursor-not-allowed' : 'text-white'
              } ${!isActive && canControl ? 'hover:opacity-70 cursor-text' : 'cursor-default'}`}
            >
              {minutes}:{seconds}
            </button>
          )}

          <div className="text-[10px] font-medium mt-1.5 tracking-wider uppercase transition-colors duration-500"
            style={{ color: isSpectator ? '#64748b' : currentMode.color + 'cc' }}
          >
            {isEditing
              ? 'set time (mm:ss)'
              : isSpectator
                ? 'watching...'
                : isActive
                  ? (mode === 'focus' ? 'Focusing...' : 'On break...')
                  : timeLeft !== currentDuration
                    ? 'paused'
                    : currentMode.label
            }
          </div>
        </div>

        {/* Lock overlay for spectators */}
        {isSpectator && (
          <div className="absolute inset-0 flex items-center justify-end pr-2 pb-12 pointer-events-none">
            <span className="text-slate-600 text-lg">🔒</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 z-10">
        <button
          onClick={resetTimer}
          disabled={!canControl}
          className={`clickable flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/5 transition-all ${
            canControl ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'text-white/15 cursor-not-allowed'
          }`}
          title={canControl ? 'Reset' : 'Only the host can reset'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={toggleTimer}
          disabled={!canControl}
          className={`clickable flex items-center justify-center w-28 h-10 rounded-full font-medium text-sm transition-all shadow-lg border ${
            !canControl
              ? 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'
              : isActive
                ? 'bg-white/8 text-white/70 border-white/10 hover:bg-white/12'
                : 'text-white border-transparent shadow-xl'
          }`}
          style={canControl && !isActive ? {
            backgroundColor: currentMode.color,
            boxShadow: `0 8px 24px ${currentMode.color}44`,
          } : {}}
        >
          {isSpectator ? 'Locked' : isActive ? 'Pause' : 'Start'}
        </button>

        <button
          onClick={handleSkip}
          disabled={!canControl}
          className={`clickable flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/5 transition-all ${
            canControl ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'text-white/15 cursor-not-allowed'
          }`}
          title={canControl ? 'Skip' : 'Only the host can skip'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Session count */}
      {sessions > 0 && (
        <div className="z-10 mt-3 text-white/25 text-[9px] tracking-widest uppercase">
          {sessions} session{sessions !== 1 ? 's' : ''} completed
        </div>
      )}
    </div>
  );
}

export default App;
