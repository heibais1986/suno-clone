
import { Song, Language } from "../types";

// Helper to generate a random ID (still used for error fallback)
const generateId = () => Math.random().toString(36).substring(2, 15);

export const generateSongConcept = async (prompt: string, language: Language = 'en'): Promise<Song> => {
  try {
    // Call the backend API (Cloudflare Function)
    // This ensures the API KEY is kept secret on the server side
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, language }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to generate song");
    }

    // The backend returns a complete Song object
    return data as Song;

  } catch (error) {
    console.error("Generation failed:", error);
    
    // Fallback for UI to show error properly
    return {
      id: generateId(),
      title: language === 'zh' ? "生成失败" : "Error Generating Song",
      artist: "System",
      imageUrl: "https://picsum.photos/400/400",
      style: "System Error",
      duration: "0:00",
      plays: 0,
      lyrics: language === 'zh' 
        ? "后端调用失败。请检查 Functions 日志。\n错误: " + (error instanceof Error ? error.message : String(error))
        : "Backend call failed. Check Logs.\nError: " + (error instanceof Error ? error.message : String(error)),
      isGenerated: true,
      audioUrl: ""
    };
  }
};
