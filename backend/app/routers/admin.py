from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models import ProductCreate, RepayRequest

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# 1. 店長收到錢 -> 扣除賒帳
@router.post("/repay")
def repay_debt(req: RepayRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    member = cursor.execute("SELECT * FROM members WHERE name = ?", (req.name,)).fetchone()
    if not member:
        raise HTTPException(status_code=404, detail="找不到此人")
    
    new_debt = member['total_debt'] - req.amount
    if new_debt < 0: new_debt = 0 # 不會變成負債
    
    cursor.execute("UPDATE members SET total_debt = ? WHERE name = ?", (new_debt, req.name))
    conn.commit()
    conn.close()
    
    return {"message": f"已收到 {req.name} 還款 ${req.amount}，剩餘欠款: ${new_debt}"}

# 2. 新增物品
@router.post("/product")
def add_product(prod: ProductCreate):
    conn = get_db()
    try:
        conn.execute("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)", 
                     (prod.name, prod.price, prod.stock))
        conn.commit()
    except:
        conn.close()
        raise HTTPException(status_code=400, detail="商品名稱可能重複了")
    
    conn.close()
    return {"message": f"成功新增商品: {prod.name}"}

# 3. 修改物品價格
@router.put("/product/{name}/price")
def update_price(name: str, new_price: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET price = ? WHERE name = ?", (new_price, name))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="找不到該商品")
        
    conn.commit()
    conn.close()
    return {"message": f"{name} 價格已更新為 ${new_price}"}

# 4. 查詢物品 (回傳價格、剩餘數量)
@router.get("/product/{name}")
def search_product(name: str):
    conn = get_db()
    prod = conn.execute("SELECT price, stock FROM products WHERE name = ?", (name,)).fetchone()
    conn.close()
    
    if not prod:
        raise HTTPException(status_code=404, detail="找不到商品")
    
    return {"name": name, "price": prod['price'], "stock": prod['stock']}