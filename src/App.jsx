import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Connect to the Live Backend URL
const socket = io('https://deepwork-backend.onrender.com');

function App() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);

  useEffect(() => {
    // Listen for incoming timer actions from the server
    socket.on('timer_action', (data) => {
      const { action, timeLeft: newTimeLeft } = data;
      
      if (action === 'start') {
        setTimeLeft(newTimeLeft);
        setIsActive(true);
      } else if (action === 'pause') {
        setTimeLeft(newTimeLeft);
        setIsActive(false);
      } else if (action === 'reset') {
        setTimeLeft(25 * 60);
        setIsActive(false);
      }
    });

    return () => {
      socket.off('timer_action');
    };
  }, []);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft => timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => {
    const newIsActive = !isActive;
    setIsActive(newIsActive);
    
    // Broadcast state to room if connected
    if (inRoom) {
      socket.emit('timer_action', { 
        roomId, 
        action: newIsActive ? 'start' : 'pause', 
        timeLeft 
      });
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(25 * 60);
    
    if (inRoom) {
      socket.emit('timer_action', { 
        roomId, 
        action: 'reset', 
        timeLeft: 25 * 60 
      });
    }
  };

  const joinRoom = () => {
    if (roomId.trim() !== '') {
      socket.emit('join_room', roomId);
      setInRoom(true);
    }
  };

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-screen h-screen bg-[#1e1e1e]/95 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-6 border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
      
      {/* Drag handle area */}
      <div className="absolute top-0 w-full h-8 flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity">
        <div className="w-12 h-1 bg-white/20 rounded-full mt-2"></div>
      </div>

      {/* Header and Room Connection */}
      <div className="z-10 w-full px-4 mt-2 flex justify-between items-center mb-4">
         <h1 className="text-white/70 text-xs tracking-widest uppercase font-medium">Deep Work</h1>
         {!inRoom ? (
           <div className="flex bg-white/5 rounded-md border border-white/10 overflow-hidden">
             <input 
               type="text" 
               placeholder="Room Code" 
               value={roomId}
               onChange={(e) => setRoomId(e.target.value)}
               className="clickable bg-transparent text-white text-xs px-2 py-1 w-20 outline-none placeholder:text-white/30"
             />
             <button onClick={joinRoom} className="clickable bg-indigo-500/80 hover:bg-indigo-500 text-white text-xs px-2 py-1 transition-colors">Join</button>
           </div>
         ) : (
           <div className="text-emerald-400 text-xs flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
             Room: {roomId}
           </div>
         )}
      </div>

      {/* Timer Display */}
      <div className="relative flex items-center justify-center w-48 h-48 mb-6 mt-2">
        <svg className="absolute w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
          <circle 
            cx="50" 
            cy="50" 
            r={radius} 
            fill="transparent" 
            stroke="#6366f1" 
            strokeWidth="4" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="text-6xl font-light tracking-tight text-white font-mono z-10">
          {minutes}:{seconds}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 z-10 pb-2">
        <button 
          onClick={resetTimer}
          className="clickable flex items-center justify-center w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition-colors border border-white/5 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
        <button 
          onClick={toggleTimer}
          className={`clickable flex items-center justify-center w-32 h-12 rounded-full font-medium transition-all shadow-lg cursor-pointer ${isActive ? 'bg-white/10 text-white border border-white/20' : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20 shadow-xl border border-indigo-400/30'}`}
        >
          {isActive ? 'Pause' : 'Start Focus'}
        </button>
      </div>
    </div>
  );
}

export default App;
