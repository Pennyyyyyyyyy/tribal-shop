from pydantic import BaseModel
from typing import List, Optional

# 購物車裡的單一商品
class CartItem(BaseModel):
    name: str
    quantity: int

# 【前台】結帳請求
# 對應需求：LinePay(無姓名) / 賒帳(有姓名)、物品辨識 yes/no
class CheckoutRequest(BaseModel):
    items: List[CartItem]       # 商品列表
    total_amount: int           # 總金額
    type: str                   # "LINEPAY" 或 "CREDIT"
    user_name: Optional[str] = None  # 族人姓名 (賒帳必填)
    is_recognized: bool         # 物品辨識準確率 (Yes/No)
    # 註：圖片會另外用 File 上傳，不包含在這個 JSON 模型裡

# 【後台/LINE】新增物品
# 對應需求：品項、價格、庫存
class ProductCreate(BaseModel):
    name: str
    price: int
    stock: int
    # 圖片建議後續再透過上傳 API 更新

# 【後台/LINE】還款請求
# 對應需求：族人姓名、還款金額
class RepayRequest(BaseModel):
    name: str
    amount: int