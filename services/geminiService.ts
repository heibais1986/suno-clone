import { GoogleGenAI, Type } from "@google/genai";
import { Song, Language } from "../types";

// Helper to generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 15);

export const generateSongConcept = async (prompt: string, language: Language = 'en'): Promise<Song> => {
  try {
    // For Cloudflare Pages or Vercel deployment:
    // Ensure you have set the 'API_KEY' environment variable in your project settings.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        console.error("CRITICAL: API Key is missing.");
        console.error("Deployment Hint: If using Cloudflare Pages, go to Settings -> Environment Variables and add 'API_KEY'.");
        throw new Error("API Key not found in environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const langInstruction = language === 'zh' ? "Please generate the response content (title, artist, style, lyrics) in Simplified Chinese." : "Generate the content in English.";

    // Step 1: Generate Text Metadata
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a creative song concept based on this prompt: "${prompt}". 
      ${langInstruction}
      Return a JSON object with a catchy title, an imaginary artist name, a music style (e.g., 'Cyberpunk Jazz'), and a short 4-line snippet of lyrics.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            artist: { type: Type.STRING },
            style: { type: Type.STRING },
            lyrics: { type: Type.STRING },
          },
          required: ["title", "artist", "style", "lyrics"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");

    // Step 2: Generate Album Art
    // Default fallback
    let imageUrl = `https://picsum.photos/seed/${encodeURIComponent(data.title)}/400/400`;

    try {
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `Album cover art for a song titled "${data.title}" in the style of ${data.style}. High quality, artistic, abstract, music visualization, 4k resolution.`,
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
                outputMimeType: 'image/jpeg',
            },
        });

        const base64 = imageResponse.generatedImages?.[0]?.image?.imageBytes;
        if (base64) {
            imageUrl = `data:image/jpeg;base64,${base64}`;
        }
    } catch (imageError) {
        console.warn("Image generation failed, using fallback.", imageError);
    }

    return {
      id: generateId(),
      title: data.title || "Untitled",
      artist: data.artist || "AI Artist",
      imageUrl: imageUrl,
      style: data.style || "Experimental",
      duration: "2:45",
      plays: 0,
      lyrics: data.lyrics,
      isGenerated: true,
    };
  } catch (error) {
    console.error("Gemini generation failed:", error);
    // Fallback for demo purposes if API fails or limit reached
    return {
      id: generateId(),
      title: language === 'zh' ? "生成失败" : "Error Generating Song",
      artist: "System",
      imageUrl: "https://picsum.photos/400/400",
      style: "System Error",
      duration: "0:00",
      plays: 0,
      lyrics: language === 'zh' 
        ? "请检查 API Key 是否配置正确 (Cloudflare 环境变量)。\n错误信息: " + (error instanceof Error ? error.message : String(error))
        : "Please check if API Key is configured correctly in Cloudflare Environment Variables.\nError: " + (error instanceof Error ? error.message : String(error)),
      isGenerated: true,
    };
  }
};