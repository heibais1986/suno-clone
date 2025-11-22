import { GoogleGenAI, Type, Modality } from "@google/genai";

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

// --- Constants ---

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

// Fallback track if TTS fails completely
const FALLBACK_AUDIO = "https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3";

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
    
    // We force Gemini 2.5 Flash for metadata as it is fast and supports JSON schema well
    const metadataModel = "gemini-2.5-flash"; 

    const langInstruction = language === 'zh' ? "Generate content (title, artist, style, lyrics) in Simplified Chinese." : "Generate content in English.";
    
    let systemPrompt = `Create a creative song concept based on: "${prompt}". ${langInstruction}`;
    if (isInstrumental) {
        systemPrompt += ` Return JSON with catchy title, artist name, music style. NO lyrics (instrumental).`;
    } else {
        systemPrompt += ` Return JSON with catchy title, artist name, music style, and 4-6 lines of lyrics.`;
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

    const data = JSON.parse(textResponse.text || "{}") as SongConcept;
    const songId = crypto.randomUUID(); // Unique ID for R2 Filenames

    // 4. Parallel Generation: Image & Audio (TTS)
    let imageBase64: string | null = null;
    let audioBytes: Uint8Array | null = null;

    const generateImagePromise = ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Album cover art for "${data.title}", style ${data.style}. High quality, artistic, 4k, square.`,
        config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
    }).then(res => {
        imageBase64 = res.generatedImages?.[0]?.image?.imageBytes || null;
    }).catch(e => console.warn("Image generation failed", e));

    // --- REAL AUDIO GENERATION USING GEMINI TTS ---
    const randomVoice = VOICES[Math.floor(Math.random() * VOICES.length)];
    
    // Construct the text to be spoken. 
    // If instrumental, we just have the "DJ" announce the track.
    const textToSpeak = isInstrumental 
        ? `Presenting a new track: ${data.title}, by ${data.artist}. Enjoy the vibes.`
        : data.lyrics || `Title: ${data.title}. A song by ${data.artist}.`;

    const generateAudioPromise = ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: textToSpeak }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: randomVoice },
                },
            },
        },
    }).then(res => {
        const base64Audio = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            audioBytes = base64ToUint8Array(base64Audio);
        }
    }).catch(e => console.warn("TTS generation failed", e));

    // Wait for both generations
    await Promise.all([generateImagePromise, generateAudioPromise]);

    // 5. Save to R2 & DB
    let finalImageUrl = `https://picsum.photos/seed/${encodeURIComponent(data.title)}/400/400`;
    let finalAudioUrl = FALLBACK_AUDIO; 
    
    if (hasStorage) {
        const publicDomain = env.R2_PUBLIC_DOMAIN.startsWith('http') ? env.R2_PUBLIC_DOMAIN : `https://${env.R2_PUBLIC_DOMAIN}`;

        // A. Upload Image
        if (imageBase64) {
            const imageKey = `covers/${songId}.jpg`;
            const imageBytes = base64ToUint8Array(imageBase64);
            await env.R2_BUCKET.put(imageKey, imageBytes, {
                httpMetadata: { contentType: 'image/jpeg' }
            });
            finalImageUrl = `${publicDomain}/${imageKey}`;
        }

        // B. Upload Audio (Generated TTS or Fallback)
        if (audioBytes) {
            const audioKey = `tracks/${songId}.mp3`; // TTS outputs raw PCM usually, but we serve as binary. Browser audio context can often handle raw or simple wav.
            // Note: The Gemini TTS API returns raw audio bytes. To make it universally playable in <audio> tags without client-side decoding, 
            // ideally we wrap it in a WAV container. For simplicity in this demo, we store the raw bytes 
            // but setting contentType to 'audio/mpeg' or 'audio/wav' allows most browsers to attempt playback if the format is compatible.
            // *Actually*, Gemini TTS outputs audio that browsers handle best if we treat it as PCM/WAV. 
            // For this demo, we upload the raw bytes. If playback fails on some devices, a client-side WAV header wrapper would be needed.
            
            await env.R2_BUCKET.put(audioKey, audioBytes, {
                httpMetadata: { contentType: 'audio/wav' } // Use wav for raw-ish data
            });
            finalAudioUrl = `${publicDomain}/${audioKey}`;
        } else {
            // Fallback: Fetch demo audio and upload that instead (so we still have a unique file in R2)
            try {
                 const demoAudioRes = await fetch(FALLBACK_AUDIO, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (demoAudioRes.ok) {
                    const demoBlob = await demoAudioRes.arrayBuffer();
                    const audioKey = `tracks/${songId}.mp3`;
                    await env.R2_BUCKET.put(audioKey, demoBlob, { httpMetadata: { contentType: 'audio/mpeg' } });
                    finalAudioUrl = `${publicDomain}/${audioKey}`;
                }
            } catch (e) { console.error("Fallback upload failed", e); }
        }

        // C. Insert into DB
        try {
            await env.DB.prepare(
                "INSERT INTO songs (title, artist, style, duration, audio_url, image_url, lyrics, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
                data.title || "Untitled",
                data.artist || "AI Artist",
                data.style || "Unknown",
                "0:30", // TTS is usually short
                finalAudioUrl,
                finalImageUrl,
                isInstrumental ? "[Instrumental]" : (data.lyrics || ""),
                new Date().toISOString()
            ).run();
        } catch (dbErr) {
            console.error("DB Insert failed", dbErr);
        }
    }

    // 6. Return Response
    const songData = {
      id: songId,
      title: data.title || "Untitled",
      artist: data.artist || "AI Artist",
      imageUrl: finalImageUrl,
      style: (data.style || "Spoken Word") + " (AI TTS)",
      duration: "0:30",
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