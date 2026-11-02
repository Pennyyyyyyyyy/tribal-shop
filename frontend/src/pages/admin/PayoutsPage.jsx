import React from "react";
import { usePayouts, taipeiToday, formatPaidAt } from "../../hooks/usePayouts";
import { StatusBadge, ConsignorPreviewCard, Notice, ErrorBanner } from "../../components/admin/payoutsShared";

export default function PayoutsPage() {
    const {
        consignorList, form, setForm,
        previews, previewErr, previewing, selected, expanded,
        bulkBusy, createErr,
        payouts, listLoading, listError,
        filterConsignor, setFilterConsignor, filterStatus, setFilterStatus, rowBusyId,
        notice, setNotice, nickname,
        loadPayouts, runBatchPreview, toggleSelected, toggleExpanded, selectAllWithSales, clearSelection,
        createSelected, totalSelectedNet, markAsPaid, deletePayout, unmarkAsPaid,
    } = usePayouts();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-[38px]">分潤結算</h1>
                <p className="text-[15px] mt-1">
                    店家抽成 30%，族人拿 70%。試算會依實際交易明細計算；產生後為「待付」狀態。
                </p>
            </div>

            {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

            {/* ── Section 1：批次試算並產生結算 ──────────────────────── */}
            <section className="panel shadow-press p-6">
                <h2 className="font-display text-[26px] pb-3 border-b-2 border-dashed border-sand">
                    批次試算並產生結算
                </h2>
                <p className="text-[15px] mt-3">
                    選期間 → 一次試算所有寄賣族人 → 勾選要建立的、按產生。
                    <span className="opacity-60 ml-1">（不會擋跟「待付」結算重疊 — 產生前請先看下方歷史清單）</span>
                </p>

                <div className="flex flex-wrap gap-3 items-center mt-4">
                    <label className="flex items-center gap-2">
                        <span className="text-base font-bold">起日</span>
                        <input
                            type="date"
                            value={form.from}
                            max={taipeiToday()}
                            onChange={e => setForm({ ...form, from: e.target.value })}
                            className="field h-11 w-auto text-base rounded-[14px] px-3"
                        />
                    </label>
                    <label className="flex items-center gap-2">
                        <span className="text-base font-bold">迄日</span>
                        <input
                            type="date"
                            value={form.to}
                            max={taipeiToday()}
                            onChange={e => setForm({ ...form, to: e.target.value })}
                            className="field h-11 w-auto text-base rounded-[14px] px-3"
                        />
                    </label>
                    <button
                        onClick={runBatchPreview}
                        disabled={!form.from || !form.to || previewing || consignorList.length === 0}
                        className="btn-press h-11 px-5 rounded-[14px] shadow-press-sm bg-forest text-paper text-lg"
                    >
                        {previewing ? `試算中… (${consignorList.length} 位)` : `試算全部 (${consignorList.length} 位)`}
                    </button>
                </div>

                {previewErr && <ErrorBanner className="mt-4">{previewErr}</ErrorBanner>}

                {previews && (
                    <div className="mt-6 flex flex-col gap-4">
                        {/* 選取工具列 */}
                        <div className="flex items-center flex-wrap gap-2.5 text-[15px]">
                            <div className="mr-auto">
                                共 {previews.length} 位族人 · 有銷售 <b className="tabular-nums">{previews.filter(p => p.gross_amount > 0).length}</b> 位 · 已選 <b className="tabular-nums text-forest">{selected.size}</b> 位
                            </div>
                            <button onClick={selectAllWithSales} className="focus-ring pill h-9 text-sm hover:border-clay">全選有銷售</button>
                            <button onClick={clearSelection} className="focus-ring pill h-9 text-sm hover:border-clay">全部取消</button>
                        </div>

                        {/* 族人卡片列表 */}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 items-start">
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
                        <div className="pt-4 border-t-2 border-dashed border-sand flex items-center justify-between flex-wrap gap-3">
                            <div className="text-base">
                                所選合計應付
                                <span className="ml-2 font-display text-[30px] tabular-nums text-forest">
                                    NT${totalSelectedNet.toLocaleString()}
                                </span>
                            </div>
                            <button
                                onClick={createSelected}
                                disabled={bulkBusy || selected.size === 0}
                                className="btn-press h-14 px-7 rounded-2xl shadow-press-sm bg-clay text-paper text-xl"
                            >
                                {bulkBusy ? "建立中…" : `產生所選 ${selected.size} 筆結算單`}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* ── Section 2：歷史結算 ───────────────────────────────── */}
            <section className="panel overflow-hidden">
                <div className="px-[22px] pt-5 pb-3.5 flex items-center justify-between flex-wrap gap-3">
                    <h2 className="font-display text-[26px]">歷史結算</h2>
                    <div className="flex items-center gap-2">
                        <select
                            value={filterConsignor}
                            onChange={e => {
                                const v = e.target.value;
                                setFilterConsignor(v);
                                loadPayouts({ consignor: v, status: filterStatus });
                            }}
                            className="focus-ring h-10 px-3 rounded-xl border-2 border-sand bg-paper text-[15px] font-bold"
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
                            className="focus-ring h-10 px-3 rounded-xl border-2 border-sand bg-paper text-[15px] font-bold"
                        >
                            <option value="">全部狀態</option>
                            <option value="pending">待付</option>
                            <option value="paid">已付</option>
                        </select>
                    </div>
                </div>

                {listError && <div className="p-4"><ErrorBanner>{listError}</ErrorBanner></div>}

                {listLoading ? (
                    <div className="p-10 text-center text-base opacity-70">載入中…</div>
                ) : payouts.length === 0 ? (
                    <div className="p-10 text-center text-base opacity-70">還沒有結算紀錄</div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="data-table min-w-[900px]">
                        <thead>
                            <tr>
                                <Th>ID</Th>
                                <Th>寄賣者</Th>
                                <Th>期間</Th>
                                <Th className="text-right">總銷售</Th>
                                <Th className="text-right">應付</Th>
                                <Th>狀態</Th>
                                <Th className="text-right">動作</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.map(p => (
                                <tr key={p.id} className="hover:bg-cream transition-colors">
                                    <Td className="tabular-nums opacity-70">#{p.id}</Td>
                                    <Td className="font-bold">{nickname(p.consignor_line_id)}</Td>
                                    <Td className="tabular-nums whitespace-nowrap">
                                        {p.period_start} ~ {p.period_end}
                                    </Td>
                                    <Td className="text-right tabular-nums">NT${(p.gross_amount || 0).toLocaleString()}</Td>
                                    <Td className="text-right tabular-nums font-display text-xl text-forest">NT${(p.net_payout || 0).toLocaleString()}</Td>
                                    <Td><StatusBadge status={p.status} /></Td>
                                    <Td className="text-right whitespace-nowrap">
                                        {p.status === "pending" ? (
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => markAsPaid(p.id)}
                                                    disabled={rowBusyId === p.id}
                                                    className="btn-press h-[38px] px-3.5 rounded-xl border-2 shadow-[0_3px_0_#4A2C1A] bg-forest text-paper text-[15px]"
                                                >
                                                    標記已付並通知
                                                </button>
                                                <button
                                                    onClick={() => deletePayout(p.id, "pending")}
                                                    disabled={rowBusyId === p.id}
                                                    className="focus-ring rounded px-1 text-sm font-bold text-clay underline disabled:opacity-40"
                                                >
                                                    刪除
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-3">
                                                <span className="text-sm">
                                                    已付於 {formatPaidAt(p.paid_at)}
                                                </span>
                                                <button
                                                    onClick={() => unmarkAsPaid(p.id)}
                                                    disabled={rowBusyId === p.id}
                                                    className="btn-ghost h-[38px] px-3.5 rounded-xl text-[15px]"
                                                >
                                                    改回待付
                                                </button>
                                                <button
                                                    onClick={() => deletePayout(p.id, "paid")}
                                                    disabled={rowBusyId === p.id}
                                                    className="focus-ring rounded px-1 text-sm font-bold text-clay underline disabled:opacity-40"
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
                    </div>
                )}
            </section>
        </div>
    );
}

function Th({ children, className = "" }) {
    return <th className={className}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={className}>{children}</td>;
}
