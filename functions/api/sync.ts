
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

    // 1. Check Environment Bindings
    if (!env.DB) {
      const availableBindings = Object.keys(env).filter(k => typeof env[k] !== 'string' && typeof env[k] !== 'number').join(', ');
      const errorMsg = `Database (DB) not bound. Found: [${availableBindings || 'NONE'}]. Check wrangler.toml or Cloudflare Dashboard.`;
      console.error(errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
    }

    if (!env.MUSIC_BUCKET) {
       return new Response(JSON.stringify({ error: "R2 Bucket (MUSIC_BUCKET) not bound." }), { status: 500 });
    }

    // 2. Prepare Public Domain
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

    // 3. List R2 Files
    const listing = await env.MUSIC_BUCKET.list();
    const audioFiles = listing.objects.filter(obj => 
      obj.key.endsWith('.mp3') || obj.key.endsWith('.wav') || obj.key.endsWith('.m4a') || obj.key.endsWith('.ogg')
    );

    // 4. Wipe Existing Data (Full Sync Strategy)
    try {
        await env.DB.prepare("DELETE FROM songs").run();
        // Optional: Reset ID counter if using AUTOINCREMENT, but UUID/String IDs don't need it.
        // await env.DB.prepare("DELETE FROM sqlite_sequence WHERE name='songs'").run(); 
    } catch (e) {
        // If table doesn't exist, ignore error (or return error if strict)
        return new Response(JSON.stringify({ error: "Table 'songs' likely missing. Run schema migration." }), { status: 500 });
    }

    if (audioFiles.length === 0) {
      return new Response(JSON.stringify({ message: "R2 is empty. Database cleared.", added: 0 }), { status: 200 });
    }

    // 5. Insert All Files
    let addedCount = 0;
    
    // Using batch insert for performance could be better, but loop is safer for now 
    // to handle individual errors without failing the whole batch in this simple setup.
    // We will construct the logic to be robust.
    
    for (const file of audioFiles) {
      // Encode key components to handle spaces/special chars safely in URL
      const encodedKey = file.key.split('/').map(encodeURIComponent).join('/');
      const fileUrl = `${publicDomain}/${encodedKey}`;

      const fileName = file.key.split('/').pop() || file.key;
      // Remove extension and replace underscores with spaces for title
      const title = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, '').replace(/_/g, ' ');
      
      // Generate metadata
      // Use filename as seed for consistent images between syncs
      const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(fileName)}/400/400`;
      const artist = "R2 Upload";
      const style = "Imported Track";
      
      // Use the file's upload date or current time
      const createdAt = file.uploaded ? new Date(file.uploaded).toISOString() : new Date().toISOString();

      try {
        await env.DB.prepare(
          "INSERT INTO songs (title, artist, style, duration, audio_url, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(title, artist, style, "Unknown", fileUrl, imageUrl, createdAt).run();
        
        addedCount++;
      } catch (err) {
        // Fallback for older schemas without created_at
         try {
            await env.DB.prepare(
                "INSERT INTO songs (title, artist, style, duration, audio_url, image_url) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(title, artist, style, "Unknown", fileUrl, imageUrl).run();
            addedCount++;
         } catch (innerErr) {
             console.error(`Failed to insert ${fileName}`, innerErr);
         }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Full sync complete. Database cleared. Added ${addedCount} songs.`,
      added: addedCount,
      total_in_r2: audioFiles.length
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
