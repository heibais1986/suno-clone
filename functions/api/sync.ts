
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
  [key: string]: any; // Allow indexing for debug logging
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;

    // 1. Diagnostic Check
    // If DB is missing, print out what IS available to help the user fix the binding name.
    if (!env.DB) {
      const availableBindings = Object.keys(env).filter(k => typeof env[k] !== 'string' && typeof env[k] !== 'number').join(', ');
      const errorMsg = `Database (DB) not bound. Found these bindings: [${availableBindings || 'NONE'}]. Please ensure your D1 binding Variable Name is exactly 'DB' in Cloudflare Dashboard or wrangler.toml.`;
      console.error(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
    }

    if (!env.R2_BUCKET) {
       const availableBindings = Object.keys(env).filter(k => typeof env[k] !== 'string' && typeof env[k] !== 'number').join(', ');
       return new Response(JSON.stringify({ error: `R2 Bucket (R2_BUCKET) not bound. Found: [${availableBindings}]. Ensure Variable Name is 'R2_BUCKET'.` }), { status: 500 });
    }

    // Default public domain if not set (fallback, usually should be set in env vars)
    const publicDomain = env.R2_PUBLIC_DOMAIN || "";

    if (!publicDomain) {
        return new Response(JSON.stringify({ error: "R2_PUBLIC_DOMAIN environment variable is missing" }), { status: 500 });
    }

    // 2. List all files in the R2 bucket
    // Note: For production with 1000+ files, you'd need pagination (cursor). 
    // For now, we list the first 1000.
    const listing = await env.R2_BUCKET.list();
    const audioFiles = listing.objects.filter(obj => 
      obj.key.endsWith('.mp3') || obj.key.endsWith('.wav') || obj.key.endsWith('.m4a') || obj.key.endsWith('.ogg')
    );

    if (audioFiles.length === 0) {
      return new Response(JSON.stringify({ message: "No audio files found in R2", added: 0 }), { status: 200 });
    }

    let addedCount = 0;

    // 3. Check DB for existing songs to avoid duplicates
    // Get all audio_urls currently in DB
    // Ensure the table exists first (basic error handling)
    try {
        await env.DB.prepare("SELECT 1 FROM songs LIMIT 1").first();
    } catch (e) {
        return new Response(JSON.stringify({ error: "Table 'songs' does not exist. Please run the SQL initialization command." }), { status: 500 });
    }

    const existingResult = await env.DB.prepare("SELECT audio_url FROM songs").all<{ audio_url: string }>();
    const existingUrls = new Set(existingResult.results.map(r => r.audio_url));

    // 4. Process files
    for (const file of audioFiles) {
      const fileUrl = `${publicDomain}/${file.key}`;

      if (!existingUrls.has(fileUrl)) {
        // Parse title from filename (e.g., "My Song.mp3" -> "My Song")
        const fileName = file.key.split('/').pop() || file.key;
        const title = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, '').replace(/_/g, ' ');
        
        // Generate a random placeholder image
        const randomId = Math.floor(Math.random() * 1000);
        const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
        
        // Random genre/artist for demo purposes (since R2 metadata is limited)
        const artist = "R2 Upload";
        const style = "Imported Track";

        // Insert into DB
        await env.DB.prepare(
          "INSERT INTO songs (title, artist, style, duration, audio_url, image_url) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(title, artist, style, "Unknown", fileUrl, imageUrl).run();

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
