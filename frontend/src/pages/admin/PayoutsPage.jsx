import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../service/adminApi";

// 預設抓「上個月整月」（Asia/Taipei）。UI 開啟即用，店長最常見的結算節奏。
function defaultLastMonthRange() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
    }).formatToParts(new Date());
    const y = parseInt(parts.find(p => p.type === "year").value);
    const m = parseInt(parts.find(p => p.type === "month").value);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const lastDay = new Date(py, pm, 0).getDate();
    return {
        from: `${py}-${String(pm).padStart(2, "0")}-01`,
        to: `${py}-${String(pm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
}

// 台灣今日 YYYY-MM-DD — 給 date input 的 max 用（結算期間不該指向未來）。
function taipeiToday() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function formatPaidAt(iso) {
    if (!iso) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(iso));
}

export default function PayoutsPage() {
    const [consignorList, setConsignorList] = useState([]);
    const defaults = useMemo(defaultLastMonthRange, []);
    const [form, setForm] = useState({ from: defaults.from, to: defaults.to });

    // 批次試算：previews = 每位族人一筆 preview 結果（含 gross=0 者）。
    // selected = 勾選要建立結算單的 line_id 集合。expanded = 展開明細的 line_id 集合。
    const [previews, setPreviews] = useState(null);
    const [previewErr, setPreviewErr] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [expanded, setExpanded] = useState(new Set());

    const [bulkBusy, setBulkBusy] = useState(false);
    const [createErr, setCreateErr] = useState(null);

    const [payouts, setPayouts] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const [filterConsignor, setFilterConsignor] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [rowBusyId, setRowBusyId] = useState(null);

    const [notice, setNotice] = useState(null); // { type: 'green'|'amber'|'red', text }

    async function loadConsignors() {
        try {
            const list = await api.consignors.list();
            setConsignorList(list);
        } catch (err) {
            setListError(err.message);
        }
    }

    async function loadPayouts(filters = { consignor: filterConsignor, status: filterStatus }) {
        setListLoading(true);
        try {
            const list = await api.payouts.list({
                consignor: filters.consignor || undefined,
                status: filters.status || undefined,
            });
            list.sort((a, b) => b.id - a.id);
            setPayouts(list);
            setListError(null);
        } catch (err) {
            setListError(err.message);
        } finally {
            setListLoading(false);
        }
    }

    useEffect(() => {
        loadConsignors();
        loadPayouts();
    }, []);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(t);
    }, [notice]);

    const nickname = (lineId) => {
        const c = consignorList.find(x => x.line_id === lineId);
        return c?.nickname || lineId;
    };

    // 批次試算：對每位族人平行呼叫 preview API。族人數少（<20）時 5xx ms 就完成。
    async function runBatchPreview() {
        if (!form.from || !form.to || consignorList.length === 0) return;
        setPreviewing(true);
        setPreviewErr(null);
        setCreateErr(null);
        try {
            const results = await Promise.all(
                consignorList.map(c =>
                    api.payouts.preview({ consignor_line_id: c.line_id, from: form.from, to: form.to })
                )
            );
            setPreviews(results);
            // 預設勾選所有「有銷售」的族人，gross=0 者不勾也 disable 掉。
            const auto = new Set(results.filter(r => r.gross_amount > 0).map(r => r.consignor.line_id));
            setSelected(auto);
            setExpanded(new Set()); // 預設全部收合
        } catch (err) {
            setPreviewErr(err.message);
            setPreviews(null);
        } finally {
            setPreviewing(false);
        }
    }

    function toggleSelected(lineId) {
        setSelected(s => {
            const next = new Set(s);
            if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
            return next;
        });
    }
    function toggleExpanded(lineId) {
        setExpanded(s => {
            const next = new Set(s);
            if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
            return next;
        });
    }
    function selectAllWithSales() {
        if (!previews) return;
        setSelected(new Set(previews.filter(p => p.gross_amount > 0).map(p => p.consignor.line_id)));
    }
    function clearSelection() {
        setSelected(new Set());
    }

    async function createSelected() {
        if (!previews) return;
        const toCreate = previews.filter(p => selected.has(p.consignor.line_id) && p.gross_amount > 0);
        if (toCreate.length === 0) return;
        setBulkBusy(true);
        setCreateErr(null);
        const results = await Promise.allSettled(
            toCreate.map(p => api.payouts.create({
                consignor_line_id: p.consignor.line_id,
                from: form.from,
                to: form.to,
            }))
        );
        const ok = [];
        const fail = [];
        results.forEach((r, i) => {
            const name = toCreate[i].consignor.nickname || toCreate[i].consignor.line_id;
            if (r.status === "fulfilled") ok.push(name);
            else fail.push(`${name}（${r.reason?.message || "unknown"}）`);
        });
        setBulkBusy(false);
        setPreviews(null);
        setSelected(new Set());
        if (fail.length === 0) {
            setNotice({ type: "green", text: `已建立 ${ok.length} 筆結算單（待付）` });
        } else if (ok.length === 0) {
            setNotice({ type: "red", text: `全部失敗：${fail.join("；")}` });
        } else {
            setNotice({ type: "amber", text: `成功 ${ok.length} 筆；失敗 ${fail.length} 筆：${fail.join("；")}` });
        }
        await loadPayouts();
    }

    // 合計試算：所有已勾選族人的 net_payout 加總
    const totalSelectedNet = useMemo(() => {
        if (!previews) return 0;
        return previews
            .filter(p => selected.has(p.consignor.line_id))
            .reduce((s, p) => s + (p.net_payout || 0), 0);
    }, [previews, selected]);

    async function markAsPaid(id) {
        if (!confirm("確認已把款項交給族人？此動作不可還原（已付結算無法刪除）。")) return;
        setRowBusyId(id);
        try {
            const r = await api.payouts.markPaid(id);
            if (r.notified) {
                setNotice({ type: "green", text: "已標記付款並通知族人" });
            } else {
                setNotice({
                    type: "amber",
                    text: "已標記付款，但 LINE 通知失敗（族人 line_id 可能是測試值或已停用）",
                });
            }
            await loadPayouts();
        } catch (err) {
            setNotice({ type: "red", text: `標記失敗：${err.message}` });
        } finally {
            setRowBusyId(null);
        }
    }

    async function deletePayout(id, status) {
        // 已付結算 = 歷史帳。字眼放重一點，避免手滑；backend 也要求 force flag。
        const msg = status === "paid"
            ? `⚠️ 這是【已付】結算單 #${id}。\n\n刪除等於抹除付款紀錄，通常應該用「改回待付」而非刪除。\n\n仍要刪除？`
            : `確定刪除結算單 #${id}？（待付狀態，可以再試算重建）`;
        if (!confirm(msg)) return;
        setRowBusyId(id);
        try {
            await api.payouts.remove(id, { force: status === "paid" });
            setNotice({ type: "green", text: `結算單 #${id} 已刪除` });
            await loadPayouts();
        } catch (err) {
            setNotice({ type: "red", text: `刪除失敗：${err.message}` });
        } finally {
            setRowBusyId(null);
        }
    }

    async function unmarkAsPaid(id) {
        if (!confirm(`把結算單 #${id} 改回「待付」？\n\npaid_at 會被清除。族人不會收到 LINE 通知（撤銷是內部作業）。`)) return;
        setRowBusyId(id);
        try {
            await api.payouts.unmarkPaid(id);
            setNotice({ type: "green", text: `結算單 #${id} 已改回待付` });
            await loadPayouts();
        } catch (err) {
            setNotice({ type: "red", text: `改回失敗：${err.message}` });
        } finally {
            setRowBusyId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800">分潤結算</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                    店家抽成 30%，族人拿 70%。試算會依實際交易明細計算；產生後為「待付」狀態。
                </p>
            </div>

            {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

            {/* ── Section 1：批次試算並產生結算 ──────────────────────── */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-200">
                    批次試算並產生結算
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                    選期間 → 一次試算所有寄賣族人 → 勾選要建立的、按產生。
                    <span className="text-slate-400 ml-1">（不會擋跟「待付」結算重疊 — 產生前請先看下方歷史清單）</span>
                </p>

                <div className="flex flex-wrap gap-3 items-end mt-4">
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">起日</span>
                        <input
                            type="date"
                            value={form.from}
                            max={taipeiToday()}
                            onChange={e => setForm({ ...form, from: e.target.value })}
                            className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-slate-600 mb-1 block">迄日</span>
                        <input
                            type="date"
                            value={form.to}
                            max={taipeiToday()}
                            onChange={e => setForm({ ...form, to: e.target.value })}
                            className="px-3 py-2 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-sm"
                        />
                    </label>
                    <button
                        onClick={runBatchPreview}
                        disabled={!form.from || !form.to || previewing || consignorList.length === 0}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm"
                    >
                        {previewing ? `試算中… (${consignorList.length} 位)` : `試算全部 (${consignorList.length} 位)`}
                    </button>
                </div>

                {previewErr && <ErrorBanner className="mt-4">{previewErr}</ErrorBanner>}

                {previews && (
                    <div className="mt-6 space-y-3">
                        {/* 選取工具列 */}
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="text-slate-500">
                                共 {previews.length} 位族人 · 有銷售 <span className="font-semibold text-slate-700 tabular-nums">{previews.filter(p => p.gross_amount > 0).length}</span> 位 · 已選 <span className="font-semibold text-green-700 tabular-nums">{selected.size}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <button onClick={selectAllWithSales} className="text-slate-500 hover:text-green-700 font-medium">全選有銷售</button>
                                <span className="text-slate-300">·</span>
                                <button onClick={clearSelection} className="text-slate-500 hover:text-slate-800 font-medium">全部取消</button>
                            </div>
                        </div>

                        {/* 族人卡片列表 */}
                        <div className="space-y-2">
                            {previews.map(p => (
                                <ConsignorPreviewCard
                                    key={p.consignor.line_id}
                                    preview={p}
                                    checked={selected.has(p.consignor.line_id)}
                                    onToggleSelect={() => toggleSelected(p.consignor.line_id)}
                                    expanded={expanded.has(p.consignor.line_id)}
                                    onToggleExpand={() => toggleExpanded(p.consignor.line_id)}
                                />
                            ))}
                        </div>

                        {createErr && <ErrorBanner>{createErr}</ErrorBanner>}

                        {/* 合計 + 產生按鈕 */}
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
                            <div className="text-sm text-slate-600">
                                所選合計應付
                                <span className="ml-2 font-bold tabular-nums text-green-700 text-lg">
                                    ${totalSelectedNet.toLocaleString()}
                                </span>
                            </div>
                            <button
                                onClick={createSelected}
                                disabled={bulkBusy || selected.size === 0}
                                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-sm font-semibold shadow-sm"
                            >
                                {bulkBusy ? "建立中…" : `產生所選 ${selected.size} 筆結算單`}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* ── Section 2：歷史結算 ───────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-base font-semibold text-slate-800">歷史結算</h3>
                    <div className="flex items-center gap-2">
                        <select
                            value={filterConsignor}
                            onChange={e => {
                                const v = e.target.value;
                                setFilterConsignor(v);
                                loadPayouts({ consignor: v, status: filterStatus });
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-xs"
                        >
                            <option value="">所有族人</option>
                            {consignorList.map(c => (
                                <option key={c.line_id} value={c.line_id}>{c.nickname}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={e => {
                                const v = e.target.value;
                                setFilterStatus(v);
                                loadPayouts({ consignor: filterConsignor, status: v });
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 focus:border-green-500 focus:outline-none bg-white text-xs"
                        >
                            <option value="">全部狀態</option>
                            <option value="pending">待付</option>
                            <option value="paid">已付</option>
                        </select>
                    </div>
                </div>

                {listError && <div className="p-4"><ErrorBanner>{listError}</ErrorBanner></div>}

                {listLoading ? (
                    <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
                ) : payouts.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">還沒有結算紀錄</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                                <Th>ID</Th>
                                <Th>寄賣者</Th>
                                <Th>期間</Th>
                                <Th className="text-right">總銷售</Th>
                                <Th className="text-right">應付</Th>
                                <Th>狀態</Th>
                                <Th className="text-right">動作</Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {payouts.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <Td className="text-slate-500 tabular-nums">#{p.id}</Td>
                                    <Td className="font-medium text-slate-800">{nickname(p.consignor_line_id)}</Td>
                                    <Td className="text-xs text-slate-600 tabular-nums">
                                        {p.period_start} ~ {p.period_end}
                                    </Td>
                                    <Td className="text-right tabular-nums text-slate-600">${(p.gross_amount || 0).toLocaleString()}</Td>
                                    <Td className="text-right tabular-nums font-semibold text-slate-800">${(p.net_payout || 0).toLocaleString()}</Td>
                                    <Td><StatusBadge status={p.status} /></Td>
                                    <Td className="text-right">
                                        {p.status === "pending" ? (
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => markAsPaid(p.id)}
                                                    disabled={rowBusyId === p.id}
                                                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-300 text-white text-xs font-semibold shadow-sm"
                                                >
                                                    標記為已付
                                                </button>
                                                <button
                                                    onClick={() => deletePayout(p.id, "pending")}
                                                    disabled={rowBusyId === p.id}
                                                    className="text-xs text-red-600 hover:text-red-800 font-medium disabled:text-slate-400"
                                                >
                                                    刪除
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-3">
                                                <span className="text-xs text-slate-500">
                                                    已付於 {formatPaidAt(p.paid_at)}
                                                </span>
                                                <button
                                                    onClick={() => unmarkAsPaid(p.id)}
                                                    disabled={rowBusyId === p.id}
                                                    className="text-xs text-slate-500 hover:text-amber-700 font-medium disabled:text-slate-400"
                                                >
                                                    改回待付
                                                </button>
                                                <button
                                                    onClick={() => deletePayout(p.id, "paid")}
                                                    disabled={rowBusyId === p.id}
                                                    className="text-xs text-red-600 hover:text-red-800 font-medium disabled:text-slate-400"
                                                >
                                                    刪除
                                                </button>
                                            </div>
                                        )}
                                    </Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}

function Th({ children, className = "" }) {
    return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function StatusBadge({ status }) {
    if (status === "paid") {
        return (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                已付
            </span>
        );
    }
    return (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            待付
        </span>
    );
}

// 批次試算的單張族人卡：顯示 KPI 一列 + 可展開商品明細 + checkbox。
// gross=0 → 顯示灰化且不能勾。
function ConsignorPreviewCard({ preview, checked, onToggleSelect, expanded, onToggleExpand }) {
    const p = preview;
    const noSales = p.gross_amount === 0;
    return (
        <div className={
            "rounded-xl border p-3 transition-colors " +
            (noSales ? "border-slate-200 bg-slate-50/50" : checked ? "border-green-300 bg-green-50/40" : "border-slate-200 bg-white")
        }>
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={noSales}
                    onChange={onToggleSelect}
                    className="mt-1 w-4 h-4 accent-green-600 disabled:cursor-not-allowed"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={"text-sm font-semibold " + (noSales ? "text-slate-400" : "text-slate-800")}>
                            {p.consignor.nickname || p.consignor.line_id}
                        </span>
                        {noSales && <span className="text-[11px] text-slate-400">此期間無銷售</span>}
                    </div>
                    {!noSales && (
                        <div className="mt-1.5 flex items-center gap-4 flex-wrap text-xs">
                            <span className="text-slate-500">
                                總銷售 <span className="font-semibold tabular-nums text-slate-800">${p.gross_amount.toLocaleString()}</span>
                            </span>
                            <span className="text-slate-500">
                                抽成 <span className="tabular-nums text-slate-700">${p.commission_amount.toLocaleString()}</span>
                            </span>
                            <span className="text-slate-500">
                                應付 <span className="font-bold tabular-nums text-green-700">${p.net_payout.toLocaleString()}</span>
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 tabular-nums">{p.items.length} 種商品</span>
                        </div>
                    )}
                </div>
                {!noSales && (
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium shrink-0"
                    >
                        {expanded ? "收起" : "明細 ▾"}
                    </button>
                )}
            </div>
            {expanded && !noSales && p.items.length > 0 && (
                <div className="mt-3 ml-7 border-t border-slate-100 pt-2">
                    <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-100">
                            {p.items.map(it => (
                                <tr key={it.product_id}>
                                    <td className="py-1.5 text-slate-800">{it.product_name}</td>
                                    <td className="py-1.5 text-right text-slate-500 tabular-nums whitespace-nowrap">
                                        ${it.unit_price} × {it.quantity}
                                    </td>
                                    <td className="py-1.5 text-right font-semibold tabular-nums text-slate-800 w-20">
                                        ${it.subtotal.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Notice({ notice, onClose }) {
    const palette = {
        green: "bg-green-50 border-green-200 text-green-700",
        amber: "bg-amber-50 border-amber-200 text-amber-800",
        red: "bg-red-50 border-red-200 text-red-700",
    }[notice.type] || "bg-slate-50 border-slate-200 text-slate-700";
    return (
        <div className={`flex items-center justify-between border rounded-xl px-3 py-2 ${palette}`}>
            <span className="text-sm">{notice.text}</span>
            <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
    );
}

function ErrorBanner({ children, className = "" }) {
    return (
        <div className={`text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 ${className}`}>
            {children}
        </div>
    );
}
