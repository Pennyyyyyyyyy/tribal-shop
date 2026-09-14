-- Step 5 附掛 — 寄賣者 LINE 自助上架 + 店長審核所需 schema。
--
-- 設計決策（走選項 A — 留 rejected row + reason 存 DB）：
-- 1. approval_status 三態：pending / approved / rejected
--    DEFAULT 'approved' 讓既有商品不受影響。
-- 2. 保留 rejected_reason：寄賣者「我的商品」看得到「已駁回：<原因>」，
--    Admin「已駁回」tab 也能追溯。DB 存的是 durable 紀錄，LINE 訊息會被洗掉。
-- 3. Index 加在 approval_status（partial 只 index 非 approved 較省，
--    但 approved 佔絕大多數 → 反過來想，index approved 沒意義；partial 剛好覆蓋兩少數態）。

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

CREATE INDEX IF NOT EXISTS products_approval_status_idx
    ON products(approval_status)
    WHERE approval_status <> 'approved';
