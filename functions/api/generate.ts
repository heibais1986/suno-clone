
import { GoogleGenAI, Type } from "@google/genai";

// --- Type Definitions ---

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  meta: any;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: any): Promise<any>;
}

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
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN: string;
  // Optional: Configure these in Cloudflare Pages Settings -> Environment Variables
  SUNO_ENDPOINT?: string; // e.g. https://my-suno-api.com/generate
  SUNO_SECRET?: string;   // Your API Key
}

interface SongConcept {
  title: string;
  artist: string;
  style: string;
  lyrics: string;
  description?: string;
}

// --- Smart Style Matching Library (Fallback) ---
// Used when Suno API is not configured or fails.
// Maps general vibes to royalty-free generic tracks.
const STYLE_LIBRARY: Record<string, string[]> = {
  electronic: [
    "https://cdn.pixabay.com/audio/2021/11/25/audio_915828c958.mp3", // Future Bass
    "https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3", // Synthwave
  ],
  rock: [
    "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3", // Indie Rock
    "https://cdn.pixabay.com/audio/2021/08/27/audio_661888b72c.mp3", // Soft Rock
  ],
  piano: [
    "https://cdn.pixabay.com/audio/2021/09/06/audio_51868b4300.mp3", // Emotional Piano
    "https://cdn.pixabay.com/audio/2022/02/07/audio_1a99125a02.mp3", // Classical
  ],
  lofi: [
    "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", // Chill
    "https://cdn.pixabay.com/audio/2021/09/06/audio_51868b4300.mp3", // Study
  ],
  jazz: [
    "https://cdn.pixabay.com/audio/2022/04/27/audio_62b356c74c.mp3", // Smooth
  ],
  ambient: [
    "https://cdn.pixabay.com/audio/2022/04/27/audio_62b356c74c.mp3", // Space
    "https://cdn.pixabay.com/audio/2021/09/06/audio_329491b981.mp3", // Meditation
  ],
  pop: [
    "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", // Upbeat
  ]
};

// --- Helpers ---

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to find the best matching audio based on style string
function getAudioForStyle(style: string): string {
  const s = style.toLowerCase();
  let category = 'electronic'; // default

  if (s.includes('rock') || s.includes('metal') || s.includes('punk')) category = 'rock';
  else if (s.includes('piano') || s.includes('classical') || s.includes('orchestra')) category = 'piano';
  else if (s.includes('lofi') || s.includes('chill') || s.includes('hip hop')) category = 'lofi';
  else if (s.includes('jazz') || s.includes('blues') || s.includes('soul')) category = 'jazz';
  else if (s.includes('ambient') || s.includes('cinematic') || s.includes('space')) category = 'ambient';
  else if (s.includes('pop') || s.includes('dance') || s.includes('happy')) category = 'pop';

  const options = STYLE_LIBRARY[category];
  return options[Math.floor(Math.random() * options.length)];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    
    // 1. Configuration Check
    if (!env.API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API_KEY" }), { status: 500 });
    }
    const hasStorage = !!(env.R2_BUCKET && env.DB && env.R2_PUBLIC_DOMAIN);

    // 2. Parse Request
    const { prompt, language, isInstrumental, model } = await request.json() as { 
        prompt: string, 
        language: 'en' | 'zh', 
        isInstrumental?: boolean,
        model?: string
    };
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: env.API_KEY });
    const songId = crypto.randomUUID(); 
    const metadataModel = "gemini-2.5-flash";

    // 3. Step 1: Generate Song Concepts (Metadata) with Gemini
    // We ask Gemini to act as the "Producer" defining the song before we create the audio.
    const langInstruction = language === 'zh' ? "Output in Simplified Chinese." : "Output in English.";
    const systemPrompt = `You are a music producer. 
    Analyze the request: "${prompt}". ${langInstruction}
    1. Create a catchy Title.
    2. Create an Artist Name.
    3. Define a specific Music Style (e.g., 'Cyberpunk Synthwave', 'Melancholic Piano', 'Upbeat Pop').
    4. ${isInstrumental ? "Do NOT write lyrics." : "Write 4-8 lines of lyrics."}
    
    Return valid JSON only.`;

    const schemaProperties: any = {
        title: { type: Type.STRING },
        artist: { type: Type.STRING },
        style: { type: Type.STRING },
        description: { type: Type.STRING, description: "A short English prompt optimized for music generation models" }
    };
    const requiredFields = ["title", "artist", "style", "description"];
    if (!isInstrumental) {
        schemaProperties.lyrics = { type: Type.STRING };
        requiredFields.push("lyrics");
    }

    const metaResponse = await ai.models.generateContent({
      model: metadataModel,
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: requiredFields,
        },
      },
    });

    const songData = JSON.parse(metaResponse.text || "{}") as SongConcept;

    // 4. Step 2: Generate Assets (Image & Audio)
    
    // 4a. Generate Cover Art
    let imageBase64: string | null = null;
    const imagePromise = ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Album cover art for "${songData.title}", style ${songData.style}. High quality, artistic, 4k, square, minimalist.`,
        config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
    }).then(res => {
        imageBase64 = res.generatedImages?.[0]?.image?.imageBytes || null;
    }).catch(e => console.warn("Image generation failed", e));


    // 4b. Generate Audio (Suno API Strategy)
    // If env.SUNO_ENDPOINT is set, we try to hit it. 
    // Otherwise, we use the smart fallback system.
    let audioSourceUrl: string | null = null;
    let isRealSuno = false;

    const audioPromise = (async () => {
        if (env.SUNO_ENDPOINT) {
            try {
                console.log("Attempting to call Suno API...");
                // Standard unofficial Suno API payload structure
                const sunoRes = await fetch(env.SUNO_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.SUNO_SECRET || ''}`
                    },
                    body: JSON.stringify({
                        prompt: songData.description || prompt,
                        mv: 'chirp-v3-0', // Common model version
                        make_instrumental: isInstrumental,
                        wait_audio: true // If supported, otherwise requires webhook handling
                    })
                });

                if (sunoRes.ok) {
                    const sunoData = await sunoRes.json() as any;
                    // Adapt based on your specific provider's response
                    const url = sunoData[0]?.audio_url || sunoData?.audio_url;
                    if (url) {
                        audioSourceUrl = url;
                        isRealSuno = true;
                    }
                }
            } catch (e) {
                console.error("Suno API call failed, falling back.", e);
            }
        }

        // Fallback if Suno failed or not configured
        if (!audioSourceUrl) {
            audioSourceUrl = getAudioForStyle(songData.style);
        }
    })();

    await Promise.all([imagePromise, audioPromise]);

    // 5. Persist to R2 & DB
    // We must download the audio (whether from Suno or Pixabay) and re-upload to R2 
    // to ensure we have a permanent copy and to bypass CORS on the client.
    let finalImageUrl = `https://picsum.photos/seed/${encodeURIComponent(songData.title)}/400/400`;
    let finalAudioUrl = "";

    if (hasStorage && audioSourceUrl) {
        const publicDomain = env.R2_PUBLIC_DOMAIN.startsWith('http') ? env.R2_PUBLIC_DOMAIN : `https://${env.R2_PUBLIC_DOMAIN}`;

        // Upload Image
        if (imageBase64) {
            const imageKey = `covers/${songId}.jpg`;
            await env.R2_BUCKET.put(imageKey, base64ToUint8Array(imageBase64), {
                httpMetadata: { contentType: 'image/jpeg' }
            });
            finalImageUrl = `${publicDomain}/${imageKey}`;
        }

        // Upload Audio
        try {
            const sourceRes = await fetch(audioSourceUrl, {
                 headers: { 'User-Agent': 'Mozilla/5.0' } // Prevent 403s
            });
            
            if (sourceRes.ok) {
                const audioBlob = await sourceRes.arrayBuffer();
                const audioKey = `tracks/${songId}.mp3`;
                await env.R2_BUCKET.put(audioKey, audioBlob, {
                    httpMetadata: { contentType: 'audio/mpeg' }
                });
                finalAudioUrl = `${publicDomain}/${audioKey}`;

                // Insert into DB
                await env.DB.prepare(
                    "INSERT INTO songs (title, artist, style, duration, audio_url, image_url, lyrics, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                ).bind(
                    songData.title || "Untitled",
                    songData.artist || "AI Artist",
                    songData.style || "Unknown",
                    isRealSuno ? "2:00" : "2:45", // Suno usually makes ~2m clips, demos are longer
                    finalAudioUrl,
                    finalImageUrl,
                    isInstrumental ? "[Instrumental]" : (songData.lyrics || ""),
                    new Date().toISOString()
                ).run();
            }
        } catch (err) {
            console.error("Failed to save assets", err);
            // Even if save fails, we can try to return the direct link if available (though CORS might block it)
            if (!finalAudioUrl) finalAudioUrl = audioSourceUrl; 
        }
    }

    // 6. Return Frontend Response
    return new Response(JSON.stringify({
      id: songId,
      title: songData.title || "Untitled",
      artist: songData.artist || "AI Artist",
      imageUrl: finalImageUrl,
      style: songData.style,
      duration: isRealSuno ? "2:00" : "2:45",
      plays: 0,
      lyrics: isInstrumental ? "[Instrumental]" : songData.lyrics,
      isGenerated: true,
      audioUrl: finalAudioUrl || audioSourceUrl // Fallback to source if R2 upload failed
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Generation Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
