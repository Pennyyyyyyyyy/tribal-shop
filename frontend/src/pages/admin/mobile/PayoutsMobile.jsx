import React from "react";
import { usePayouts, taipeiToday, formatPaidAt } from "../../../hooks/usePayouts";
import { StatusBadge, ConsignorPreviewCard, Notice, ErrorBanner } from "../../../components/admin/payoutsShared";
import { PageHeader, Card, Loading, Empty } from "../../../components/admin/mobile/mobileShared";

// iPhone 上 select 字級 < 16px 會在點選時自動放大畫面，所以這裡用 text-base
const SELECT = "focus-ring h-11 min-w-0 flex-1 px-2.5 rounded-xl border-2 border-sand bg-paper text-base font-bold";

export default function PayoutsMobile() {
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
        <div className="flex flex-col gap-3.5">
            <PageHeader title="分潤結算" subtitle="試算後產生「待付」結算單" />

            {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

            <section className="panel px-3.5 py-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2.5">
                    <label className="min-w-0">
                        <span className="text-sm font-bold">起日</span>
                        <input type="date" value={form.from} max={taipeiToday()} onChange={e => setForm({ ...form, from: e.target.value })} className="field h-12 mt-1 px-2 text-base" />
                    </label>
                    <label className="min-w-0">
                        <span className="text-sm font-bold">迄日</span>
                        <input type="date" value={form.to} max={taipeiToday()} onChange={e => setForm({ ...form, to: e.target.value })} className="field h-12 mt-1 px-2 text-base" />
                    </label>
                </div>
                <button
                    onClick={runBatchPreview}
                    disabled={!form.from || !form.to || previewing || consignorList.length === 0}
                    className="btn-press h-12 rounded-2xl shadow-press-sm bg-forest text-paper text-lg"
                >
                    {previewing ? `試算中… (${consignorList.length} 位)` : `試算全部 (${consignorList.length} 位)`}
                </button>

                {previewErr && <ErrorBanner>{previewErr}</ErrorBanner>}

                {previews && (
                    <>
                        <div className="flex items-center gap-1 text-sm">
                            <span className="flex-1">
                                有銷售 {previews.filter(p => p.gross_amount > 0).length} 位 · 已選 <b className="text-forest">{selected.size}</b> 位
                            </span>
                            <button onClick={selectAllWithSales} className="focus-ring h-11 px-2 rounded-lg text-forest font-bold">全選</button>
                            <button onClick={clearSelection} className="focus-ring h-11 px-2 rounded-lg text-forest font-bold">全部取消</button>
                        </div>
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
                        {createErr && <ErrorBanner>{createErr}</ErrorBanner>}
                        <div className="flex justify-between items-baseline pt-2 border-t-2 border-dashed border-sand">
                            <span className="font-bold">所選合計應付</span>
                            <span className="font-display text-[26px] text-forest tabular-nums">NT${totalSelectedNet.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={createSelected}
                            disabled={bulkBusy || selected.size === 0}
                            className="btn-press h-14 rounded-2xl shadow-press-sm bg-clay text-paper text-[19px]"
                        >
                            {bulkBusy ? "建立中…" : `建立 ${selected.size} 筆結算`}
                        </button>
                    </>
                )}
            </section>

            <h2 className="font-display text-[22px] mt-1">歷史結算</h2>
            <div className="flex gap-2">
                <select
                    aria-label="寄賣者"
                    value={filterConsignor}
                    onChange={e => {
                        const v = e.target.value;
                        setFilterConsignor(v);
                        loadPayouts({ consignor: v, status: filterStatus });
                    }}
                    className={SELECT}
                >
                    <option value="">所有族人</option>
                    {consignorList.map(c => <option key={c.line_id} value={c.line_id}>{c.nickname}</option>)}
                </select>
                <select
                    aria-label="狀態"
                    value={filterStatus}
                    onChange={e => {
                        const v = e.target.value;
                        setFilterStatus(v);
                        loadPayouts({ consignor: filterConsignor, status: v });
                    }}
                    className={SELECT}
                >
                    <option value="">全部狀態</option>
                    <option value="pending">待付</option>
                    <option value="paid">已付</option>
                </select>
            </div>

            {listError && <ErrorBanner>{listError}</ErrorBanner>}

            {listLoading ? <Loading /> : payouts.length === 0 ? (
                <Empty>還沒有結算紀錄</Empty>
            ) : payouts.map(p => (
                <Card key={p.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{nickname(p.consignor_line_id)}</div>
                            <div className="text-[13px] tabular-nums">{p.period_start} ~ {p.period_end}</div>
                        </div>
                        <StatusBadge status={p.status} />
                    </div>
                    <div className="flex justify-between text-sm tabular-nums">
                        <span>總銷售 NT${(p.gross_amount || 0).toLocaleString()}</span>
                        <span>應付 <b className="font-display font-normal text-lg text-forest">NT${(p.net_payout || 0).toLocaleString()}</b></span>
                    </div>
                    {p.status === "pending" ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => markAsPaid(p.id)}
                                disabled={rowBusyId === p.id}
                                className="focus-ring flex-1 h-11 rounded-xl bg-forest text-paper text-[15px] font-bold disabled:opacity-50"
                            >
                                標記已付並通知
                            </button>
                            <button
                                onClick={() => deletePayout(p.id, "pending")}
                                disabled={rowBusyId === p.id}
                                className="focus-ring h-11 px-2 rounded-lg text-sm font-bold text-clay underline disabled:opacity-40"
                            >
                                刪除
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="flex-1 text-[13px]">已付於 {formatPaidAt(p.paid_at)}</span>
                            <button
                                onClick={() => unmarkAsPaid(p.id)}
                                disabled={rowBusyId === p.id}
                                className="btn-ghost h-11 px-3 rounded-xl text-sm"
                            >
                                改回待付
                            </button>
                            <button
                                onClick={() => deletePayout(p.id, "paid")}
                                disabled={rowBusyId === p.id}
                                className="focus-ring h-11 px-2 rounded-lg text-sm font-bold text-clay underline disabled:opacity-40"
                            >
                                刪除
                            </button>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );
}
