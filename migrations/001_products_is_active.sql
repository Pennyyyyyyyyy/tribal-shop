-- 商品上架旗標。TRUE = 上架中（POS 顧客看得到）。
-- 已存在的商品都預設上架，不影響現況。
-- 執行方式：貼進 Supabase Dashboard → SQL Editor → Run。
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
