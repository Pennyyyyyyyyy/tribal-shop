-- Step 3 附掛 — 把歷史 transaction.item_list JSON 拆成 transaction_items 行。
--
-- 執行前確認：
--   1. 002_consignment.sql 已跑過（transaction_items 表存在）
--   2. Supabase 有備份
--
-- 注意：
--   - transaction.item_list 是 text 欄位存 JSON.stringify(cart) 的結果
--   - 每個 cart item 形狀：{ id, name, price, quantity, image_url, ... }
--     (id / price / quantity 都是 number，image_url 可能無)
--   - product_id 用 bigint（對齊 products.id 型別）
--   - consignor_line_id 用「現在」products.consignor_line_id snapshot。
--     backfill 前若已有商品轉手，歷史帳只能取當下狀態 —— 無法避免的失真。
--   - 有些舊 transaction 可能 item_list 為 null / 空字串 / 非合法 JSON → 過濾。

-- Idempotency guard：transaction_items 已有資料就中斷，避免重覆 backfill。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transaction_items LIMIT 1) THEN
    RAISE EXCEPTION 'transaction_items 已經有資料，backfill 中止避免重覆。若要強制，先手動 TRUNCATE。';
  END IF;
END $$;

INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, consignor_line_id)
SELECT
  t.id                                                AS transaction_id,
  NULLIF(item->>'id', '')::bigint                     AS product_id,
  COALESCE(NULLIF(item->>'quantity', '')::int, 1)     AS quantity,
  COALESCE(NULLIF(item->>'price', '')::int, 0)        AS unit_price,
  p.consignor_line_id
FROM transaction t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN t.item_list IS NULL OR t.item_list = '' THEN '[]'::jsonb
    ELSE t.item_list::jsonb
  END
) AS item
LEFT JOIN products p ON p.id = NULLIF(item->>'id', '')::bigint
WHERE item ? 'id';   -- 忽略沒 id 的怪 item
