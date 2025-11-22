
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

function buf2hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
}

function hex2buf(hex: string) {
    return new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
}

async function verifyPassword(inputPassword: string, storedPasswordString: string): Promise<boolean> {
  // storedPasswordString format: "saltHex:hashHex"
  const parts = storedPasswordString.split(':');
  if (parts.length !== 2) return false;

  const [saltHex, originalHashHex] = parts;
  const salt = hex2buf(saltHex);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", 
    encoder.encode(inputPassword), 
    { name: "PBKDF2" }, 
    false, 
    ["deriveBits"]
  );

  // Recalculate hash using the EXTRACTED salt and SAME iterations
  const hashBuffer = await crypto.subtle.deriveBits(
    { 
      name: "PBKDF2", 
      salt: salt, 
      iterations: 100000, 
      hash: "SHA-256" 
    }, 
    keyMaterial, 
    256
  );

  const newHashHex = buf2hex(hashBuffer);
  
  // Constant-time comparison is better, but for this context string comparison is acceptable
  return newHashHex === originalHashHex;
}

interface UserRow {
  id: unknown;
  email: string;
  password: string;
  [key: string]: any;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { email, password } = await request.json() as any;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), { status: 400 });
    }

    // MOCK MODE
    if (!env.DB) {
        if (email.includes('demo')) {
             return new Response(JSON.stringify({ success: true, user: { email, id: 'demo' } }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Mock Mode: Database not connected. Use 'demo' in email to bypass." }), { status: 401 });
    }

    // Retrieve user record including the stored password hash
    const user = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).bind(email).first<UserRow>();

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
    }

    // Verify Password
    const isValid = await verifyPassword(password, user.password);

    if (isValid) {
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      return new Response(JSON.stringify({ success: true, user: userWithoutPassword }), { status: 200 });
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
