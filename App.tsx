
import React, { useState, useRef, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CreateSection from './components/CreateSection';
import Marquee from './components/Marquee';
import SongCard from './components/SongCard';
import Player from './components/Player';
import AuthModal from './components/AuthModal';
import { getSampleSongs, TRANSLATIONS } from './constants';
import { Song, Language } from './types';
import { ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  // Separate generated songs so they persist across language changes
  const [generatedSongs, setGeneratedSongs] = useState<Song[]>([]);
  // Songs fetched from the D1 database (Real R2 uploads)
  const [dbSongs, setDbSongs] = useState<Song[]>([]);
  
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  // Default language set to Chinese
  const [language, setLanguage] = useState<Language>('zh'); 
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Player State
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  const t = TRANSLATIONS[language].app;

  // Fetch real songs from backend on load
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const res = await fetch('/api/songs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setDbSongs(data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch songs from DB:", error);
        // Fail silently
      }
    };
    fetchSongs();
  }, []);

  // --- Logic to Prioritize R2 Data ---
  const hasRealData = dbSongs.length > 0;
  const sampleSongs = getSampleSongs(language);

  // If we have real songs, use ONLY real songs + generated ones.
  // If no real songs, fallback to samples.
  const baseSongs = hasRealData ? dbSongs : sampleSongs;

  // Combine generated songs at the very top/front
  const allDisplaySongs = [...generatedSongs, ...baseSongs];

  // --- Filter Logic for Search ---
  // If searchQuery is present, we filter the lists.
  // The Player uses 'playlist' which corresponds to what the user sees/filters.
  const filterSong = (s: Song) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.style.toLowerCase().includes(q)
    );
  };

  const currentPlaylist = allDisplaySongs.filter(filterSong);

  // Player Navigation Handlers
  const handleNext = () => {
    if (!currentSong || currentPlaylist.length === 0) return;

    let nextSong: Song;

    if (isShuffle) {
        // Pick a random song from the CURRENT PLAYLIST (filtered)
        const available = currentPlaylist.filter(s => s.id !== currentSong.id);
        // If only 1 song in list, play it again
        if (available.length === 0) {
            nextSong = currentSong;
        } else {
            const randomIndex = Math.floor(Math.random() * available.length);
            nextSong = available[randomIndex];
        }
    } else {
        // Sequential in CURRENT PLAYLIST
        const currentIndex = currentPlaylist.findIndex(s => s.id === currentSong.id);
        
        // If current not found (e.g. list changed due to filter), start from 0
        if (currentIndex === -1) {
            nextSong = currentPlaylist[0];
        } else if (currentIndex < currentPlaylist.length - 1) {
            nextSong = currentPlaylist[currentIndex + 1];
        } else {
            // End of list -> Loop back to start
            nextSong = currentPlaylist[0];
        }
    }
    
    setCurrentSong(nextSong);
  };

  const handlePrev = () => {
    if (!currentSong || currentPlaylist.length === 0) return;

    // Previous always goes to previous in list for UX consistency
    const currentIndex = currentPlaylist.findIndex(s => s.id === currentSong.id);
    
    let prevSong: Song;
    if (currentIndex === -1 || currentIndex === 0) {
        prevSong = currentPlaylist[currentPlaylist.length - 1];
    } else {
        prevSong = currentPlaylist[currentIndex - 1];
    }

    setCurrentSong(prevSong);
  };

  // --- Mutual Exclusivity Logic ---

  const toggleShuffle = () => {
    if (isShuffle) {
      // Turning off shuffle
      setIsShuffle(false);
    } else {
      // Turning on shuffle -> Force repeat OFF (Mutually Exclusive)
      setIsShuffle(true);
      setRepeatMode('off');
    }
  };
  
  const toggleRepeat = () => {
    // Cycle: off -> all -> one -> off
    let nextMode: 'off' | 'all' | 'one' = 'off';
    
    if (repeatMode === 'off') nextMode = 'all';
    else if (repeatMode === 'all') nextMode = 'one';
    else if (repeatMode === 'one') nextMode = 'off';

    setRepeatMode(nextMode);

    // If entering any repeat mode -> Force shuffle OFF (Mutually Exclusive)
    if (nextMode !== 'off') {
      setIsShuffle(false);
    }
  };

  // Trending Section (Top 10) - Filtered
  const trendingSongs = currentPlaylist.slice(0, 10);
  
  // New Releases - Filtered
  const rawNewReleases = hasRealData ? [...dbSongs] : [...sampleSongs].reverse();
  const newReleases = rawNewReleases.filter(filterSong).slice(0, 10);

  const handleSongGenerated = (newSong: Song) => {
    setGeneratedSongs(prev => [newSong, ...prev]);
    setCurrentSong(newSong); // Auto play generated song
  };

  // --- Enhanced Drag to Scroll Logic ---
  const createDragHandler = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      setIsDragging(true);
      setStartX(e.pageX - scrollRef.current.offsetLeft);
      setScrollLeft(scrollRef.current.scrollLeft);
    };

    const onMouseLeave = () => {
      setIsDragging(false);
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    const onMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 1.5; 
      scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    return {
      ref: scrollRef,
      isDragging,
      events: {
        onMouseDown,
        onMouseLeave,
        onMouseUp,
        onMouseMove,
      }
    };
  };

  const trendingDrag = createDragHandler();
  const newReleasesDrag = createDragHandler();

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-white/20 pb-32">
      <Navbar 
        language={language} 
        setLanguage={setLanguage} 
        onOpenAuth={() => setIsAuthModalOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      
      <main>
        {/* Only show Hero and Marquee if NOT searching to reduce clutter, or keep them? 
            Standard practice: Keep them, but maybe user wants to focus on results.
            Let's keep them for now as per "filter existing lists" strategy. 
        */}
        <Hero language={language} />
        
        <div className="relative z-20">
           <CreateSection onSongGenerated={handleSongGenerated} language={language} />
           
           <div className="mt-16 mb-8 border-y border-white/5 bg-black/20 backdrop-blur-sm py-2">
             <Marquee language={language} songs={baseSongs} />
           </div>
           
           <div className="max-w-[1600px] mx-auto px-4 md:px-6 space-y-12">
             
             {/* Trending / Search Results */}
             <section>
               <div className="flex items-center justify-between mb-6 px-2">
                 <div className="flex items-baseline gap-4">
                    <h2 className="text-2xl font-bold hover:text-white cursor-pointer transition-colors">
                        {searchQuery ? (language === 'zh' ? '搜索结果' : 'Search Results') : t.trending}
                    </h2>
                    {!searchQuery && (
                        <span className="text-sm text-zinc-500 hidden md:inline-block cursor-pointer hover:text-zinc-300 transition-colors">{t.global}</span>
                    )}
                 </div>
                 {!searchQuery && (
                    <button className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
                        {t.loadMore} <ChevronRight className="w-4 h-4" />
                    </button>
                 )}
               </div>
               
               <div 
                 ref={trendingDrag.ref}
                 {...trendingDrag.events}
                 className={`flex gap-5 overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide select-none ${trendingDrag.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
               >
                 {trendingSongs.map((song) => (
                   <div key={song.id} className="min-w-[220px] md:min-w-[240px] shrink-0 pointer-events-none md:pointer-events-auto">
                     <div className="pointer-events-auto">
                        <SongCard 
                            song={song} 
                            onClick={(s) => {
                                if (!trendingDrag.isDragging) setCurrentSong(s);
                            }}
                            language={language}
                        />
                     </div>
                   </div>
                 ))}
                 {trendingSongs.length === 0 && (
                    <div className="text-zinc-500 text-sm py-8 w-full text-center border border-dashed border-zinc-800 rounded-lg">
                        {searchQuery 
                            ? (language === 'zh' ? '没有找到匹配的歌曲' : 'No matching songs found') 
                            : (language === 'zh' ? '暂无音乐，点击上方同步按钮' : 'No songs found. Click sync to load from R2.')
                        }
                    </div>
                 )}
               </div>
             </section>

             {/* Only show New Releases if there are results and we aren't heavily searching (optional, but let's show filtered new releases too) */}
             {newReleases.length > 0 && (
                 <section>
                   <div className="flex items-center justify-between mb-6 px-2">
                     <h2 className="text-2xl font-bold hover:text-white cursor-pointer transition-colors">{language === 'zh' ? '最新发布' : 'New Arrivals'}</h2>
                     <button className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
                        {t.loadMore} <ChevronRight className="w-4 h-4" />
                     </button>
                   </div>
                   
                   <div 
                     ref={newReleasesDrag.ref}
                     {...newReleasesDrag.events}
                     className={`flex gap-5 overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide select-none ${newReleasesDrag.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                   >
                     {newReleases.map((song) => (
                       <div key={`new-${song.id}`} className="min-w-[220px] md:min-w-[240px] shrink-0">
                          <div className="pointer-events-auto">
                            <SongCard 
                                song={song} 
                                onClick={(s) => {
                                    if (!newReleasesDrag.isDragging) setCurrentSong(s);
                                }}
                                language={language}
                            />
                          </div>
                       </div>
                     ))}
                   </div>
                 </section>
             )}

           </div>
        </div>
      </main>

      <Player 
        currentSong={currentSong} 
        language={language} 
        onNext={() => handleNext()} 
        onPrev={handlePrev}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeat}
      />

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        language={language}
      />

      {currentSong?.lyrics && (
        <div className="fixed bottom-24 right-6 w-80 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl z-40 animate-in slide-in-from-bottom-5 hidden md:block">
          <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2 tracking-wider">{t.lyricsTitle}</h3>
          <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            <p className="text-sm text-zinc-300 whitespace-pre-line italic font-serif leading-relaxed">
              "{currentSong.lyrics}"
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
             <span className="text-xs text-zinc-500">Gemini 2.5 Flash</span>
             <span className="text-xs text-green-400 flex items-center gap-1">
               <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> {t.complete}
             </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
