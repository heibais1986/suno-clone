
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

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), { status: 400 });
    }

    // MOCK MODE: If DB is not bound, allow a specific demo account or fail
    if (!env.DB) {
        // For demo purposes without DB:
        if (email.includes('demo')) {
             return new Response(JSON.stringify({ success: true, user: { email, id: 'demo' } }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Mock Mode: Database not connected. Use 'demo' in email to bypass." }), { status: 401 });
    }

    // Replicate the hashing logic from register.ts
    const myText = new TextEncoder().encode(password + "SALT_SECRET"); 
    const hashBuffer = await crypto.subtle.digest('SHA-256', myText);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check credentials
    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE email = ? AND password = ?"
    ).bind(email, passwordHash).first();

    if (user) {
      return new Response(JSON.stringify({ success: true, user }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server Error" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
