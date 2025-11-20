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

    // Simple hashing for demo (Use bcrypt/argon2 in production with proper polyfills)
    const myText = new TextEncoder().encode(password + "SALT_SECRET"); // Use a real secret env var
    const hashBuffer = await crypto.subtle.digest('SHA-256', myText);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if user exists
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 });
    }

    // Insert user
    const result = await env.DB.prepare(
      "INSERT INTO users (email, password) VALUES (?, ?)"
    ).bind(email, passwordHash).run();

    if (result.success) {
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } else {
       throw new Error("Database insertion failed");
    }

  } catch (e) {
    // Ensure we return JSON even on crash
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server Error" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}