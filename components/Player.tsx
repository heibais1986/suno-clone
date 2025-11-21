
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, Maximize2, VolumeX } from 'lucide-react';
import { Song, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface PlayerProps {
  currentSong: Song | null;
  language: Language;
  onNext: () => void;
  onPrev: () => void;
}

const Player: React.FC<PlayerProps> = ({ currentSong, language, onNext, onPrev }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const t = TRANSLATIONS[language].player;

  // Reset player state when song changes
  useEffect(() => {
    if (currentSong && audioRef.current) {
       // Auto play when song changes
       audioRef.current.play().then(() => {
         setIsPlaying(true);
       }).catch(err => console.log("Auto-play prevented:", err));
    }
  }, [currentSong]);

  if (!currentSong) return null;

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 px-4 md:px-8 py-3 z-50 flex items-center justify-between animate-in slide-in-from-bottom-10 transition-all duration-500">
      
      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        src={currentSong.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
           // Song finished, play next
           onNext();
        }}
      />

      {/* Song Info */}
      <div className="flex items-center gap-4 w-1/3">
        <div className={`relative w-12 h-12 rounded bg-zinc-800 overflow-hidden ${isPlaying ? 'animate-pulse' : ''}`}>
           <img src={currentSong.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="hidden md:block">
          <h4 className="text-sm font-bold text-white truncate max-w-[150px]">{currentSong.title}</h4>
          <p className="text-xs text-zinc-400 truncate max-w-[150px]">{currentSong.artist}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-2 w-1/3">
        <div className="flex items-center gap-6">
          <button className="text-zinc-400 hover:text-white transition-colors hover:scale-110"><Shuffle className="w-4 h-4" /></button>
          
          <button 
            onClick={onPrev}
            className="text-zinc-200 hover:text-white transition-colors hover:scale-110"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-black fill-black" />
            ) : (
              <Play className="w-4 h-4 text-black fill-black ml-0.5" />
            )}
          </button>
          
          <button 
            onClick={onNext}
            className="text-zinc-200 hover:text-white transition-colors hover:scale-110"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button className="text-zinc-400 hover:text-white transition-colors hover:scale-110"><Repeat className="w-4 h-4" /></button>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md flex items-center gap-2 text-xs text-zinc-500 font-mono">
           <span className="w-8 text-right">{formatTime(currentTime)}</span>
           <div className="relative flex-1 h-1 group cursor-pointer">
              {/* Background Line */}
              <div className="absolute inset-0 rounded-full bg-zinc-800"></div>
              {/* Played Line */}
              <div 
                className="absolute top-0 left-0 h-full bg-white group-hover:bg-green-500 rounded-full transition-colors"
                style={{ width: `${progressPercent}%` }}
              ></div>
              {/* Input Range for seeking (invisible but clickable) */}
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
           </div>
           <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume & Extras */}
      <div className="flex items-center justify-end gap-4 w-1/3">
         {currentSong.lyrics && (
           <div className="hidden lg:flex px-2 py-0.5 rounded border border-white/10 text-[10px] text-zinc-400 bg-zinc-900 hover:border-white/30 cursor-help transition-colors">
             {t.lyrics}
           </div>
         )}
         <div className="flex items-center gap-2 group">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white">
               {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden relative">
              <div className={`h-full bg-white group-hover:bg-green-500 ${isMuted ? 'w-0' : 'w-2/3'}`}></div>
            </div>
         </div>
         <button className="text-zinc-400 hover:text-white"><Maximize2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default Player;
