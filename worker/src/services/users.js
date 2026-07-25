// 使用者（LINE user + 對話狀態）業務邏輯。
import * as supabase from "../lib/supabase.js";

export async function getByLineId(env, lineId) {
    const r = await supabase.query(env, `/rest/v1/users?line_id=eq.${lineId}&select=*`);
    return r[0] || null;
}

// 第一次跟 bot 互動的人自動註冊為寄賣者（role='consignor'）。
export async function autoRegister(env, lineId) {
    const newUser = { line_id: lineId, nickname: "新夥伴", role: "consignor" };
    await supabase.post(env, "/rest/v1/users", newUser);
    return newUser;
}

export async function listManagers(env) {
    return supabase.query(env, "/rest/v1/users?role=eq.manager&select=line_id");
}

// 對話狀態 (last_command + temp_data) — bot 用來追蹤多步驟流程。
export async function setState(env, lineId, lastCommand, tempData) {
    const body = { last_command: lastCommand };
    if (tempData !== undefined) body.temp_data = tempData;
    return supabase.patch(env, `/rest/v1/users?line_id=eq.${lineId}`, body);
}

export async function resetState(env, lineId) {
    return supabase.patch(env, `/rest/v1/users?line_id=eq.${lineId}`, { last_command: null });
}
