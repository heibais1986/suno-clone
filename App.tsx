
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

  // Trending Section (Top 10)
  const trendingSongs = allDisplaySongs.slice(0, 10);
  
  // New Releases (Top 10, newest first)
  // Note: /api/songs returns ORDER BY created_at DESC, so dbSongs are already "Newest".
  // If using sample songs, we just reverse them to fake "newness".
  const newReleases = hasRealData 
    ? [...dbSongs].slice(0, 10) 
    : [...sampleSongs].reverse().slice(0, 10);

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
      const walk = (x - startX) * 1.5; // Scroll speed multiplier
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
      />
      
      <main>
        <Hero language={language} />
        
        <div className="relative z-20">
           <CreateSection onSongGenerated={handleSongGenerated} language={language} />
           
           {/* Marquee Section - Now passes dynamic songs */}
           <div className="mt-16 mb-8 border-y border-white/5 bg-black/20 backdrop-blur-sm py-2">
             <Marquee language={language} songs={baseSongs} />
           </div>
           
           {/* Main Content */}
           <div className="max-w-[1600px] mx-auto px-4 md:px-6 space-y-12">
             
             {/* Generated/Trending Section */}
             <section>
               <div className="flex items-center justify-between mb-6 px-2">
                 <div className="flex items-baseline gap-4">
                    <h2 className="text-2xl font-bold hover:text-white cursor-pointer transition-colors">{t.trending}</h2>
                    <span className="text-sm text-zinc-500 hidden md:inline-block cursor-pointer hover:text-zinc-300 transition-colors">{t.global}</span>
                 </div>
                 <button className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
                    {t.loadMore} <ChevronRight className="w-4 h-4" />
                 </button>
               </div>
               
               {/* Horizontal Scroll Container with Drag Support */}
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
                        {language === 'zh' ? '暂无音乐，点击上方同步按钮' : 'No songs found. Click sync to load from R2.'}
                    </div>
                 )}
               </div>
             </section>

             {/* New Releases Section */}
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
                 {newReleases.length === 0 && (
                    <div className="text-zinc-500 text-sm py-8 w-full text-center border border-dashed border-zinc-800 rounded-lg">
                        ...
                    </div>
                 )}
               </div>
             </section>

           </div>
        </div>
      </main>

      <Player currentSong={currentSong} language={language} />

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        language={language}
      />

      {/* Generated Lyrics Modal Overlay */}
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
