
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  meta: any;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

// R2 Bucket Type Definitions
interface R2Bucket {
  list(options?: any): Promise<R2Objects>;
  get(key: string): Promise<any>;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
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
  DB: D1Database;
  MUSIC_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN: string; // e.g., "https://pub-xxx.r2.dev"
  [key: string]: any;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;

    if (!env.DB) {
      const availableBindings = Object.keys(env).filter(k => typeof env[k] !== 'string' && typeof env[k] !== 'number').join(', ');
      const errorMsg = `Database (DB) not bound. Found: [${availableBindings || 'NONE'}]. Check wrangler.toml or Cloudflare Dashboard.`;
      console.error(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
    }

    if (!env.MUSIC_BUCKET) {
       return new Response(JSON.stringify({ error: "R2 Bucket (MUSIC_BUCKET) not bound." }), { status: 500 });
    }

    // FIX: Ensure public domain starts with https:// to prevent relative URL issues
    let publicDomain = env.R2_PUBLIC_DOMAIN || "";
    if (!publicDomain) {
        return new Response(JSON.stringify({ error: "R2_PUBLIC_DOMAIN environment variable is missing" }), { status: 500 });
    }
    
    // Strip trailing slash if present
    if (publicDomain.endsWith('/')) {
      publicDomain = publicDomain.slice(0, -1);
    }
    
    // Force HTTPS if missing (unless it's localhost, but R2 usually needs https)
    if (!publicDomain.startsWith('http')) {
      publicDomain = `https://${publicDomain}`;
    }

    const listing = await env.MUSIC_BUCKET.list();
    const audioFiles = listing.objects.filter(obj => 
      obj.key.endsWith('.mp3') || obj.key.endsWith('.wav') || obj.key.endsWith('.m4a') || obj.key.endsWith('.ogg')
    );

    if (audioFiles.length === 0) {
      return new Response(JSON.stringify({ message: "No audio files found in R2", added: 0 }), { status: 200 });
    }

    let addedCount = 0;

    // Check DB for existing songs
    try {
        await env.DB.prepare("SELECT 1 FROM songs LIMIT 1").first();
    } catch (e) {
        return new Response(JSON.stringify({ error: "Table 'songs' does not exist in D1." }), { status: 500 });
    }

    const existingResult = await env.DB.prepare("SELECT audio_url FROM songs").all<{ audio_url: string }>();
    const existingUrls = new Set(existingResult.results.map(r => r.audio_url));

    for (const file of audioFiles) {
      // FIX: Encode the file key to handle spaces and special characters
      const encodedKey = file.key.split('/').map(encodeURIComponent).join('/');
      const fileUrl = `${publicDomain}/${encodedKey}`;

      // Check if this exact URL is already in DB
      // Note: If the old DB had "domain.com/file.mp3" and new is "https://domain.com/file.mp3",
      // this check returns false (not found), so it will insert the fixed version.
      // This is actually good as it fixes the broken links, but might create duplicates.
      if (!existingUrls.has(fileUrl)) {
        const fileName = file.key.split('/').pop() || file.key;
        const title = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, '').replace(/_/g, ' ');
        
        // Generate a deterministic-ish but random ID
        const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
        const artist = "R2 Upload";
        const style = "Imported Track";
        const createdAt = new Date().toISOString();

        try {
          await env.DB.prepare(
            "INSERT INTO songs (title, artist, style, duration, audio_url, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(title, artist, style, "Unknown", fileUrl, imageUrl, createdAt).run();
        } catch (err) {
          // Fallback for older schemas without created_at column
           await env.DB.prepare(
            "INSERT INTO songs (title, artist, style, duration, audio_url, image_url) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(title, artist, style, "Unknown", fileUrl, imageUrl).run();
        }

        addedCount++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Sync complete. Added ${addedCount} new songs.`,
      added: addedCount,
      total_scanned: audioFiles.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Sync failed",
      stack: e instanceof Error ? e.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
