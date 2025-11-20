import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CreateSection from './components/CreateSection';
import Marquee from './components/Marquee';
import SongCard from './components/SongCard';
import Player from './components/Player';
import AuthModal from './components/AuthModal';
import { getSampleSongs, TRANSLATIONS } from './constants';
import { Song, Language } from './types';
import { Loader2, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  // Separate generated songs so they persist across language changes
  const [generatedSongs, setGeneratedSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  // Default language set to Chinese
  const [language, setLanguage] = useState<Language>('zh'); 
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const t = TRANSLATIONS[language].app;

  // Merge generated songs with localized sample songs
  const sampleSongs = getSampleSongs(language);
  
  // Group songs for different sections to mimic a rich dashboard
  const trendingSongs = [...generatedSongs, ...sampleSongs].slice(0, 6);
  const newReleases = [...sampleSongs].reverse().slice(0, 6);

  const handleSongGenerated = (newSong: Song) => {
    setGeneratedSongs(prev => [newSong, ...prev]);
    setCurrentSong(newSong); // Auto play generated song
  };

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
           
           {/* Marquee Section - Ambient Background */}
           <div className="mt-16 mb-8 border-y border-white/5 bg-black/20 backdrop-blur-sm py-2">
             <Marquee language={language} />
           </div>
           
           {/* Main Content - Horizontal Scrolling Sections (Suno Style) */}
           <div className="max-w-[1600px] mx-auto px-6 space-y-12">
             
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
               
               {/* Horizontal Scroll Container */}
               <div className="flex gap-5 overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide snap-x">
                 {trendingSongs.map((song) => (
                   <div key={song.id} className="min-w-[220px] md:min-w-[240px] snap-start">
                     <SongCard 
                        song={song} 
                        onClick={setCurrentSong}
                        language={language}
                     />
                   </div>
                 ))}
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
               
               <div className="flex gap-5 overflow-x-auto pb-8 -mx-6 px-6 scrollbar-hide snap-x">
                 {newReleases.map((song) => (
                   <div key={`new-${song.id}`} className="min-w-[220px] md:min-w-[240px] snap-start">
                     <SongCard 
                        song={song} 
                        onClick={setCurrentSong}
                        language={language}
                     />
                   </div>
                 ))}
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
        <div className="fixed bottom-24 right-6 w-80 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl z-40 animate-in slide-in-from-bottom-5">
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