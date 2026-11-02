// 分潤結算的資料與動作：批次試算、建立結算、歷史清單、標記已付（電腦版與手機版共用）
import { useEffect, useMemo, useState } from "react";
import * as api from "../service/adminApi";

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
export function taipeiToday() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function formatPaidAt(iso) {
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

export function usePayouts() {
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

    return {
        consignorList, form, setForm,
        previews, previewErr, previewing, selected, expanded,
        bulkBusy, createErr,
        payouts, listLoading, listError,
        filterConsignor, setFilterConsignor, filterStatus, setFilterStatus, rowBusyId,
        notice, setNotice, nickname,
        loadPayouts, runBatchPreview, toggleSelected, toggleExpanded, selectAllWithSales, clearSelection,
        createSelected, totalSelectedNet, markAsPaid, deletePayout, unmarkAsPaid,
    };
}
