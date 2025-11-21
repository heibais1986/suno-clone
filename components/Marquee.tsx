
import React from 'react';
import { getSampleSongs } from '../constants';
import { Language, Song } from '../types';

interface MarqueeProps {
  language: Language;
  songs?: Song[];
}

const SongItem: React.FC<{ song: Song }> = ({ song }) => (
  <div 
    className="w-64 h-24 bg-zinc-900/80 border border-white/5 rounded-xl flex items-center gap-4 p-3 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 will-change-transform"
  >
     <div className="w-16 h-16 shrink-0 bg-zinc-800 rounded-md overflow-hidden">
        <img src={song.imageUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
     </div>
     <div className="flex flex-col overflow-hidden min-w-0">
        <span className="font-bold text-white truncate text-sm">{song.title}</span>
        <span className="text-xs text-zinc-400 truncate">{song.artist}</span>
        <span className="text-[10px] text-zinc-500 mt-1 uppercase border border-white/10 px-1.5 py-0.5 rounded w-fit">{song.style.split('•')[0]}</span>
     </div>
  </div>
);

const Marquee: React.FC<MarqueeProps> = ({ language, songs = [] }) => {
  // Use passed songs first, fallback to samples only if empty
  const sampleSongs = getSampleSongs(language);
  const displaySongs = songs.length > 0 ? songs : sampleSongs;

  // We need enough items to scroll smoothly. 
  // If we have few songs, duplicate them more times.
  let items = [...displaySongs, ...displaySongs];
  if (items.length < 10) {
      items = [...items, ...items, ...items]; // Triple it if list is short
  }

  return (
    <div className="w-full overflow-hidden bg-zinc-950 py-12 flex flex-col gap-6 mask-linear-gradient relative z-0">
      
      {/* Row 1: Moving Left */}
      <div className="flex gap-6 w-max animate-marquee hover:[animation-play-state:paused]">
        {items.map((song, index) => (
          <SongItem key={`r1-${index}-${song.id}`} song={song} />
        ))}
      </div>

      {/* Row 2: Moving Right (Reverse) */}
      <div className="flex gap-6 w-max animate-marquee-reverse hover:[animation-play-state:paused]">
        {items.slice().reverse().map((song, index) => (
          <SongItem key={`r2-${index}-${song.id}`} song={song} />
        ))}
      </div>
      
    </div>
  );
};

export default Marquee;
