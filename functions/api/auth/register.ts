
// Type definitions for Cloudflare Pages Functions environment
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
}

// --- Security Helpers ---

function buf2hex(input: ArrayBuffer | Uint8Array) {
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
  return [...buffer]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  // 1. Generate a unique random salt for this user (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 2. Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw", 
    encoder.encode(password), 
    { name: "PBKDF2" }, 
    false, 
    ["deriveBits"]
  );

  // 3. Derive bits (Hash) using PBKDF2-SHA256 with 100,000 iterations
  // This makes it computationally expensive to brute-force
  const hashBuffer = await crypto.subtle.deriveBits(
    { 
      name: "PBKDF2", 
      salt: salt, 
      iterations: 100000, 
      hash: "SHA-256" 
    }, 
    keyMaterial, 
    256 // 256 bits length
  );

  // 4. Return as "salt:hash" so we can retrieve the salt later for verification
  return `${buf2hex(salt)}:${buf2hex(hashBuffer)}`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { email, password } = await request.json() as any;

    if (!email || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
    }

    // MOCK MODE: If DB is not bound (e.g. local dev without wrangler setup), return success
    if (!env.DB) {
        return new Response(JSON.stringify({ success: true, warning: "Mock Mode: No DB attached" }), { status: 201 });
    }

    // Check if user exists
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 });
    }

    // Secure Hashing
    const securePasswordString = await hashPassword(password);

    // Insert user
    const result = await env.DB.prepare(
      "INSERT INTO users (email, password) VALUES (?, ?)"
    ).bind(email, securePasswordString).run();

    if (result.success) {
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } else {
       throw new Error("Database insertion failed");
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server Error" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
