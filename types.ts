export type Language = 'en' | 'zh';

export interface Song {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  style: string;
  duration: string; // Display string like "3:20"
  plays: number;
  lyrics?: string;
  isGenerated?: boolean;
  audioUrl: string; // URL to the audio file (R2 or other source)
}

export interface GenerationState {
  isGenerating: boolean;
  prompt: string;
  result: Song | null;
  error: string | null;
}