// Supabase REST + Storage 低階 wrapper。只做 HTTP、不含業務邏輯。
// 所有 services/ 都透過這裡讀寫 Supabase，方便之後統一改 header / 加 retry。

function authHeaders(env) {
    return {
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    };
}

export async function query(env, path) {
    const r = await fetch(`${env.SUPABASE_URL}${path}`, { headers: authHeaders(env) });
    return r.json();
}

export async function post(env, path, body) {
    return fetch(`${env.SUPABASE_URL}${path}`, {
        method: "POST",
        headers: { ...authHeaders(env), "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

// POST + Prefer: return=representation → 回傳插入的第一筆
export async function postReturn(env, path, body) {
    const r = await fetch(`${env.SUPABASE_URL}${path}`, {
        method: "POST",
        headers: {
            ...authHeaders(env),
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || !Array.isArray(data)) {
        console.error(`[supabase] postReturn ${path} 失敗 status=${r.status}:`, JSON.stringify(data));
        throw new Error(`Supabase postReturn 失敗 (${r.status}): ${data?.message || data?.hint || "unknown"}`);
    }
    return data[0];
}

export async function patch(env, path, body) {
    return fetch(`${env.SUPABASE_URL}${path}`, {
        method: "PATCH",
        headers: { ...authHeaders(env), "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function remove(env, path) {
    return fetch(`${env.SUPABASE_URL}${path}`, {
        method: "DELETE",
        headers: authHeaders(env),
    });
}

// Supabase Storage：把 blob 上傳到指定 bucket + path，回傳 public URL。
// upsert=true 時舊檔會被覆蓋（用在訓練照片重傳）。
export async function uploadPublic(env, bucket, path, blob, contentType = "image/jpeg", upsert = false) {
    const headers = { ...authHeaders(env), "Content-Type": contentType };
    if (upsert) headers["x-upsert"] = "true";
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers,
        body: blob,
    });
    return publicUrl(env, bucket, path);
}

export function publicUrl(env, bucket, path) {
    return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
