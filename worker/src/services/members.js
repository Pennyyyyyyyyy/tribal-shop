// 賒帳族人業務邏輯。
import * as supabase from "../lib/supabase.js";

export async function list(env) {
    return supabase.query(env, "/rest/v1/member?select=id,nickname,total_debt&order=nickname");
}

export async function listAllNicknames(env) {
    return supabase.query(env, "/rest/v1/member?select=nickname");
}

export async function getById(env, id) {
    const r = await supabase.query(env, `/rest/v1/member?id=eq.${id}`);
    return r[0] || null;
}

export async function getByNickname(env, nickname) {
    const r = await supabase.query(env, `/rest/v1/member?nickname=eq.${nickname}&select=*`);
    return r[0] || null;
}

// 店長主動幫族人開帳（不用等對方加 LINE bot）。
export async function create(env, { nickname }) {
    return supabase.postReturn(env, "/rest/v1/member", {
        nickname,
        total_debt: 0,
    });
}

// 更新族人暱稱（LINE bot 自動註冊的預設是「新夥伴」，店長常要改）。
export async function updateNickname(env, id, nickname) {
    return supabase.patch(env, `/rest/v1/member?id=eq.${id}`, { nickname });
}

// 賒帳成立：新增 credit 紀錄 + 累加 total_debt + 把 transaction 的 identity 改成族人名。
export async function addDebtForTransaction(env, { memberId, txId, amount }) {
    const member = await getById(env, memberId);
    if (!member) return null;
    await supabase.post(env, "/rest/v1/credit", {
        member_id: memberId,
        transaction_id: txId,
        transaction_total: amount,
    });
    await supabase.patch(env, `/rest/v1/member?id=eq.${memberId}`, {
        total_debt: (member.total_debt || 0) + amount,
    });
    return member;
}

// 還款：從 total_debt 扣掉 amount，不低於 0。回傳新的 total_debt。
export async function repay(env, id, amount) {
    const member = await getById(env, id);
    if (!member) return null;
    const newTotalDebt = Math.max(0, (member.total_debt || 0) - amount);
    await supabase.patch(env, `/rest/v1/member?id=eq.${id}`, { total_debt: newTotalDebt });
    return newTotalDebt;
}

// Dashboard 用：全體未還款金額總和。
export async function totalOutstandingDebt(env) {
    const all = await supabase.query(env, "/rest/v1/member?select=total_debt");
    return all.reduce((s, m) => s + (m.total_debt || 0), 0);
}
