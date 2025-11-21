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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;

    // 1. 如果没有绑定数据库（本地开发或未配置），返回空数组，防止报错
    if (!env.DB) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. 从数据库查询所有歌曲，按时间倒序排列
    // 注意：我们需要把数据库的 snake_case 字段映射为前端的 camelCase 字段
    const { results } = await env.DB.prepare(
      "SELECT * FROM songs ORDER BY created_at DESC"
    ).all();

    // 3. 格式化数据以匹配 TypeScript 的 Song 接口
    const songs = results.map((row: any) => ({
      id: row.id.toString(),
      title: row.title,
      artist: row.artist,
      imageUrl: row.image_url || "https://picsum.photos/400/400", // 默认封面
      style: row.style || "Unknown",
      duration: row.duration || "0:00",
      plays: row.plays || 0,
      lyrics: row.lyrics || "",
      isGenerated: false,
      audioUrl: row.audio_url // 这是 R2 的公开链接
    }));

    return new Response(JSON.stringify(songs), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error fetching songs" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};