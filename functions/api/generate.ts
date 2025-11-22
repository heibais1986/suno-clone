
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
}

interface SongConcept {
  title: string;
  artist: string;
  style: string;
  lyrics: string;
}

// --- Helpers ---

// Convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    
    // 1. Check Configuration
    if (!env.API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API_KEY" }), { status: 500 });
    }
    // Check R2 and DB bindings if we want to save
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

    // 3. Initialize Gemini for Metadata
    const ai = new GoogleGenAI({ apiKey: env.API_KEY });
    const langInstruction = language === 'zh' ? "Generate content (title, artist, style) in Simplified Chinese." : "Generate content in English.";
    
    let modelId = "gemini-2.5-flash";
    if (model === 'gemini-3.0') modelId = "gemini-3-pro-preview";

    let systemPrompt = `Create a creative song concept based on: "${prompt}". ${langInstruction}`;
    if (isInstrumental) {
        systemPrompt += ` Return JSON with catchy title, artist name, music style. NO lyrics (instrumental).`;
    } else {
        systemPrompt += ` Return JSON with catchy title, artist name, music style, and 4 lines of lyrics.`;
    }

    const schemaProperties: any = {
        title: { type: Type.STRING },
        artist: { type: Type.STRING },
        style: { type: Type.STRING },
    };
    const requiredFields = ["title", "artist", "style"];
    if (!isInstrumental) {
        schemaProperties.lyrics = { type: Type.STRING };
        requiredFields.push("lyrics");
    }

    const textResponse = await ai.models.generateContent({
      model: modelId,
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

    const data = JSON.parse(textResponse.text || "{}") as SongConcept;
    const songId = crypto.randomUUID(); // Unique ID for this generation

    // 4. Generate Image
    let imageBase64: string | null = null;
    try {
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `Album cover art for "${data.title}", style ${data.style}. High quality, artistic, 4k, square.`,
            config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
        });
        imageBase64 = imageResponse.generatedImages?.[0]?.image?.imageBytes || null;
    } catch (e) {
        console.warn("Image generation failed", e);
    }

    // 5. Save to R2 (If bindings exist)
    let finalImageUrl = `https://picsum.photos/seed/${encodeURIComponent(data.title)}/400/400`;
    let finalAudioUrl = "https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3"; // Fallback demo
    
    if (hasStorage) {
        const publicDomain = env.R2_PUBLIC_DOMAIN.startsWith('http') ? env.R2_PUBLIC_DOMAIN : `https://${env.R2_PUBLIC_DOMAIN}`;

        // A. Upload Image to R2
        if (imageBase64) {
            const imageKey = `covers/${songId}.jpg`;
            const imageBytes = base64ToUint8Array(imageBase64);
            await env.R2_BUCKET.put(imageKey, imageBytes, {
                httpMetadata: { contentType: 'image/jpeg' }
            });
            finalImageUrl = `${publicDomain}/${imageKey}`;
        }

        // B. Upload Audio to R2 (Fetch demo audio and store it as a unique file)
        // In a real app, you would generate audio bytes here. 
        // For now, we fetch the demo file and upload it so it persists in YOUR bucket.
        try {
            const demoAudioRes = await fetch(finalAudioUrl);
            if (demoAudioRes.ok) {
                const audioBlob = await demoAudioRes.arrayBuffer();
                const audioKey = `tracks/${songId}.mp3`;
                await env.R2_BUCKET.put(audioKey, audioBlob, {
                    httpMetadata: { contentType: 'audio/mpeg' }
                });
                finalAudioUrl = `${publicDomain}/${audioKey}`;
            }
        } catch (err) {
            console.error("Failed to upload audio to R2", err);
        }

        // C. Insert into DB
        try {
            await env.DB.prepare(
                "INSERT INTO songs (id, title, artist, style, duration, audio_url, image_url, lyrics, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
                songId,
                data.title || "Untitled",
                data.artist || "AI Artist",
                data.style || "Unknown",
                "2:45",
                finalAudioUrl,
                finalImageUrl,
                isInstrumental ? "[Instrumental]" : (data.lyrics || ""),
                new Date().toISOString()
            ).run();
        } catch (dbErr) {
            console.error("DB Insert failed", dbErr);
            // We continue returning the song even if DB save fails, 
            // so the user sees it in the UI immediately.
        }
    }

    // 6. Return Response
    const songData = {
      id: songId,
      title: data.title || "Untitled",
      artist: data.artist || "AI Artist",
      imageUrl: finalImageUrl,
      style: data.style || "Experimental",
      duration: "2:45",
      plays: 0,
      lyrics: isInstrumental ? "[Instrumental]" : data.lyrics,
      isGenerated: true,
      audioUrl: finalAudioUrl
    };

    return new Response(JSON.stringify(songData), {
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
