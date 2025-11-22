
import { GoogleGenAI, Type } from "@google/genai";

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

type PagesFunction<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>> =
  (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;

interface Env {
  API_KEY: string;
}

// Replicating strictly necessary types to avoid path import issues in Functions context
interface SongConcept {
  title: string;
  artist: string;
  style: string;
  lyrics: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    
    // 1. Validate API Key
    const apiKey = env.API_KEY;
    if (!apiKey) {
      console.error("API_KEY missing in Cloudflare Environment Variables");
      return new Response(JSON.stringify({ error: "Server configuration error: API_KEY is missing." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Parse Request
    const { prompt, language } = await request.json() as { prompt: string, language: 'en' | 'zh' };
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    // 3. Initialize Gemini
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const langInstruction = language === 'zh' ? "Please generate the response content (title, artist, style, lyrics) in Simplified Chinese." : "Generate the content in English.";

    // 4. Generate Text Metadata
    const textResponse = await ai.models.generateContent({
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

    const data = JSON.parse(textResponse.text || "{}") as SongConcept;

    // 5. Generate Album Art
    // Default fallback
    let imageUrl = `https://picsum.photos/seed/${encodeURIComponent(data.title || 'music')}/400/400`;

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

    // 6. Construct Response
    // Generate a random ID for the frontend
    const generateId = () => Math.random().toString(36).substring(2, 15);
    const DEMO_GENERATED_AUDIO = "https://cdn.freesound.org/previews/719/719349_5034008-lq.mp3";

    const songData = {
      id: generateId(),
      title: data.title || "Untitled",
      artist: data.artist || "AI Artist",
      imageUrl: imageUrl,
      style: data.style || "Experimental",
      duration: "2:45",
      plays: 0,
      lyrics: data.lyrics,
      isGenerated: true,
      audioUrl: DEMO_GENERATED_AUDIO
    };

    return new Response(JSON.stringify(songData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Gemini generation failed:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
