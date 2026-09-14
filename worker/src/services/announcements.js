// 布告欄業務邏輯。POS 現場平板會拉這個表顯示。
import * as supabase from "../lib/supabase.js";

export async function create(env, { title = "店長廣播", description }) {
    return supabase.post(env, "/rest/v1/announcement", {
        title,
        description,
        upload_time: new Date().toISOString(),
    });
}

export async function list(env) {
    return supabase.query(env, "/rest/v1/announcement?select=*&order=upload_time.desc");
}

// Admin 編輯歷史公告（title / description，upload_time 不動）。
export async function update(env, id, { title, description }) {
    const body = {};
    if (title !== undefined) body.title = title;
    if (description !== undefined) body.description = description;
    return supabase.patch(env, `/rest/v1/announcement?id=eq.${id}`, body);
}

export async function remove(env, id) {
    return supabase.remove(env, `/rest/v1/announcement?id=eq.${id}`);
}
