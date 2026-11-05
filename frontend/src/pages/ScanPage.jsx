import React, {
  useRef,
  useState,
  useEffect,
} from "react";

import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";
import RoiEditor from "../components/RoiEditor";
import CartIcon from "../components/CartIcon";
import CameraIcon from "../components/CameraIcon";
import BackButton from "../components/BackButton";


const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(
    window.location.search
  ).get("e2e") === "true";


const DEFAULT_ROI_LAYOUTS = {
  1: [
    { id: 1, name: "ROI 1", x1: 0.20, y1: 0.15, x2: 0.80, y2: 0.85 }
  ],
  2: [
    { id: 1, name: "ROI 1", x1: 0.08, y1: 0.18, x2: 0.46, y2: 0.82 },
    { id: 2, name: "ROI 2", x1: 0.54, y1: 0.18, x2: 0.92, y2: 0.82 }
  ],
  3: [
    { id: 1, name: "ROI 1", x1: 0.05, y1: 0.20, x2: 0.32, y2: 0.80 },
    { id: 2, name: "ROI 2", x1: 0.365, y1: 0.20, x2: 0.635, y2: 0.80 },
    { id: 3, name: "ROI 3", x1: 0.68, y1: 0.20, x2: 0.95, y2: 0.80 }
  ]
};


export default function ScanPage() {

  const navigate = useNavigate();

  const {
    products,
    cart,
    addItemToCart,
    addItemsToCart,
    addScannedItems,
    removeScan,
    increaseQty,
    decreaseQty,
    resetAll,
    totalAmount,
    API_BASE_URL,
  } = useCheckout();

  // 鏡頭狀態（右上角「鏡頭已就緒」）
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState("");
  // 拍照辨識失敗的原因（顯示在相機畫面上；不再用假資料頂替）
  const [scanError, setScanError] = useState("");
  // 目前結果畫面對應的是第幾次辨識（「重新拍照」時要撤銷的就是這次）
  const [currentScanId, setCurrentScanId] = useState(null);

  const stepClassLg =
    "focus-ring w-12 h-12 rounded-full bg-paper text-[26px] font-bold flex items-center justify-center active:scale-95 transition cursor-pointer select-none";


  const [
    scanPhase,
    setScanPhase,
  ] = useState("IDLE");


  const [
    scannedResults,
    setScannedResults,
  ] = useState([]);

  const [
    scanData,
    setScanData,
  ] = useState(null);


  const [
    lastAddedItem,
    setLastAddedItem,
  ] = useState(null);



  const [
    uploadedImagePreview,
    setUploadedImagePreview,
  ] = useState(null);


  const [
    developerMode,
    setDeveloperMode,
  ] = useState(false);

  // 模式切換：auto (自動分切) vs roi (固定 1~3 格)
  // 每次進入 /scan 一律從「自動辨識」開始，不沿用上次的選擇
  const [scanMode, setScanMode] = useState("auto");

  // ROI 件數：1, 2, 3
  const [roiCount, setRoiCount] = useState(() => {
    const saved = parseInt(localStorage.getItem("tribal_roi_count") || "1", 10);
    return [1, 2, 3].includes(saved) ? saved : 1;
  });

  // 自訂 ROI 框線座標記憶
  const [customRoiLayouts, setCustomRoiLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem("tribal_custom_rois");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleModeChange = (mode) => {
    setScanMode(mode);
  };

  const handleRoiCountChange = (count) => {
    setRoiCount(count);
    localStorage.setItem("tribal_roi_count", String(count));
  };

  const activeRoiRegions =
    customRoiLayouts[roiCount] ||
    DEFAULT_ROI_LAYOUTS[roiCount] ||
    DEFAULT_ROI_LAYOUTS[1];

  const [
    roiRegions,
    setRoiRegions,
  ] = useState([]);


  const [
    roiSaving,
    setRoiSaving,
  ] = useState(false);


  const scanVideoRef =
    useRef(null);


  const imageInputRef =
    useRef(null);


  const callVisionAPI = async (
    imageFile
  ) => {

    const formData =
      new FormData();


    const fileName =
      imageFile instanceof File
        ? imageFile.name
        : "frame.jpg";


    formData.append(
      "file",
      imageFile,
      fileName
    );
    formData.append(
      "image",
      imageFile,
      fileName
    );


    let url = `${API_BASE_URL}/vision/scan-table?mode=${scanMode}`;
    if (scanMode === "roi") {
      url += `&roi_count=${roiCount}`;
      if (activeRoiRegions) {
        url += `&roi_regions=${encodeURIComponent(JSON.stringify(activeRoiRegions))}`;
      }
    }

    console.log(
      "呼叫 Vision API:",
      url
    );

    let resp;
    try {
      resp = await fetch(
        url,
        {
          method: "POST",
          body: formData,
        }
      );
    } catch (netErr) {
      console.warn("呼叫 /vision/scan-table 連線異常，嘗試 /vision/detect-product 備援", netErr);
      resp = await fetch(
        `${API_BASE_URL}/vision/detect-product`,
        {
          method: "POST",
          body: formData,
        }
      );
    }


    console.log(
      "Vision API HTTP status:",
      resp.status
    );


    if (!resp.ok) {

      const errorText =
        await resp.text();


      throw new Error(
        `Vision API ${resp.status}: ${errorText}`
      );
    }


    const data =
      await resp.json();


    console.log(
      "Vision API 回傳:",
      data
    );


    return data;
  };


  const loadROIConfig =
    async () => {

      try {

        const resp =
          await fetch(
            `${API_BASE_URL}/vision/roi-config`
          );


        if (!resp.ok) {

          const text =
            await resp.text();


          throw new Error(
            `讀取 ROI 失敗：${text}`
          );
        }


        const data =
          await resp.json();


        if (
          Array.isArray(
            data.regions
          )
        ) {

          setRoiRegions(
            data.regions
          );
        }


      } catch (error) {

        console.error(
          "讀取 ROI 設定失敗:",
          error
        );
      }
    };


  const saveROIConfig =
    async () => {

      if (
        roiRegions.length !== 6
      ) {

        alert(
          "ROI 設定不完整，目前必須有 6 個辨識區。"
        );

        return;
      }


      try {

        setRoiSaving(true);


        const resp =
          await fetch(
            `${API_BASE_URL}/vision/roi-config`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  regions:
                    roiRegions,
                }),
            }
          );


        const data =
          await resp.json();


        if (!resp.ok) {

          throw new Error(
            data.detail ||
            "ROI 儲存失敗"
          );
        }


        setRoiRegions(
          data.regions
        );


        alert(
          "ROI 辨識區設定已儲存"
        );


      } catch (error) {

        console.error(
          "ROI 儲存失敗:",
          error
        );


        alert(
          `ROI 儲存失敗：${error.message}`
        );


      } finally {

        setRoiSaving(false);
      }
    };



  const resetROIConfig =
    async () => {

      const confirmed =
        window.confirm(
          "確定要將辨識區重設成預設 2 × 3 嗎？"
        );


      if (!confirmed) {

        return;
      }


      try {

        const resp =
          await fetch(
            `${API_BASE_URL}/vision/roi-config/reset`,
            {
              method: "POST",
            }
          );


        const data =
          await resp.json();


        if (!resp.ok) {

          throw new Error(
            data.detail ||
            "ROI 重設失敗"
          );
        }


        setRoiRegions(
          data.regions
        );


      } catch (error) {

        console.error(
          "ROI 重設失敗:",
          error
        );


        alert(
          `ROI 重設失敗：${error.message}`
        );
      }
    };



  useEffect(() => {

    if (!API_BASE_URL) {
      return;
    }


    loadROIConfig();

  }, [API_BASE_URL]);


  const doScan = async () => {

    setScanPhase(
      "SCANNING"
    );

    setScanData(null);
    setScanError("");

    setScannedResults(
      []
    );

    // 失敗原因，最後統一顯示
    let failReason = "鏡頭沒有畫面，請確認鏡頭已接上並允許使用。";



    if (isE2E) {
      const base =
        products
          .slice(0, 3)
          .map((p) => ({
            ...p,
            id: String(p.id),
            product_id: String(p.id),
            quantity: 1,
            confidence: 0.5,
            isMock: true,
          }));

      const mockPhoto = await new Promise((resolve) => {
        const c = document.createElement("canvas");
        c.width = 320;
        c.height = 180;
        c.getContext("2d").fillRect(0, 0, 320, 180);
        c.toBlob(resolve, "image/jpeg", 0.8);
      });
      setCurrentScanId(addScannedItems(base, mockPhoto));
      setScannedResults(
        base
      );
      setScanData({
        cart_items: base,
        total_objects_detected: base.length,
        unrecognized_count: 0,
      });

      setScanPhase(
        "RESULT"
      );

      return;
    }



    const video =
      scanVideoRef.current;


    if (
      video &&
      video.videoWidth
    ) {

      try {


        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          video.videoWidth;


        canvas.height =
          video.videoHeight;


        const context =
          canvas.getContext(
            "2d"
          );


        if (!context) {

          throw new Error(
            "無法建立 Canvas Context"
          );
        }




        context.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height
        );



        const blob =
          await new Promise(
            (resolve) => {

              canvas.toBlob(
                resolve,
                "image/jpeg",
                0.8
              );

            }
          );


        if (!blob) {

          throw new Error(
            "無法產生圖片 Blob"
          );
        }


        console.log(
          "相機截圖完成，Blob size:",
          blob.size
        );



        const data =
          await callVisionAPI(
            blob
          );



        if (data && data.status === "success") {
          let itemsToAdd = [];
          if (Array.isArray(data.cart_items) && (data.cart_items.length > 0 || data.total_objects_detected > 0)) {
            itemsToAdd = data.cart_items.map((item) => ({
              ...item,
              id: String(item.product_id || item.id),
              product_id: String(item.product_id || item.id),
              quantity: Number(item.quantity) || 1,
            }));
          } else if (Array.isArray(data.predictions) && data.predictions.length > 0) {
            itemsToAdd = data.predictions.map((item) => ({
              ...item,
              id: String(item.id || item.product_id),
              product_id: String(item.id || item.product_id),
              quantity: 1,
              isMock: false,
            }));
          }

          // 累加進購物車，並記下這次拍的照片（結帳時才一起送到 LINE）
          setCurrentScanId(addScannedItems(itemsToAdd, blob));

          setScanData(data);
          setScannedResults(itemsToAdd);
          setScanPhase("RESULT");
          return;
        }


        console.warn(
          "後端沒有回傳有效 predictions:",
          data
        );
        failReason = data?.message || "辨識服務沒有回傳有效結果，請再拍一次。";


      } catch (err) {

        console.warn(
          "拍照辨識失敗",
          err
        );
        failReason = "連不上辨識服務，請確認辨識程式已啟動。";
      }
    }



    // 辨識失敗：不再拿商品清單前 3 個當假結果（會讓客人為沒拿的商品付錢），
    // 購物車保持原樣，回到可再拍照的狀態並提示原因
    setScanError(failReason);
    setScanPhase("IDLE");
  };



  const handleImageUpload =
    async (
      event
    ) => {

      const file =
        event.target.files?.[0];


      if (!file) {

        return;
      }



      if (
        !file.type.startsWith(
          "image/"
        )
      ) {

        alert(
          "請選擇圖片檔案"
        );


        event.target.value =
          "";


        return;
      }


      console.log(
        "選擇圖片:",
        file.name,
        file.type,
        file.size
      );

      if (
        uploadedImagePreview
      ) {

        URL.revokeObjectURL(
          uploadedImagePreview
        );
      }



      const previewUrl =
        URL.createObjectURL(
          file
        );


      setUploadedImagePreview(
        previewUrl
      );


      setScanPhase(
        "SCANNING"
      );

      setScanData(null);

      setScannedResults(
        []
      );


      try {
        const data =
          await callVisionAPI(
            file
          );


        console.log(
          "匯入圖片辨識結果:",
          data
        );


        if (data && data.status === "success") {
          let itemsToAdd = [];
          if (Array.isArray(data.cart_items) && (data.cart_items.length > 0 || data.total_objects_detected > 0)) {
            itemsToAdd = data.cart_items.map((item) => ({
              ...item,
              id: String(item.product_id || item.id),
              product_id: String(item.product_id || item.id),
              quantity: Number(item.quantity) || 1,
            }));
          } else if (Array.isArray(data.predictions) && data.predictions.length > 0) {
            itemsToAdd = data.predictions.map((item) => ({
              ...item,
              id: String(item.id || item.product_id),
              product_id: String(item.id || item.product_id),
              quantity: 1,
              isMock: false,
            }));
          }

          // 累加進購物車，並記下這張匯入的照片
          setCurrentScanId(addScannedItems(itemsToAdd, file));

          setScanData(data);
          setScannedResults(itemsToAdd);
          setScanPhase("RESULT");
          return;
        }


        console.warn(
          "後端沒有回傳有效 predictions:",
          data
        );


        setScannedResults(
          []
        );


        setScanPhase(
          "IDLE"
        );


        alert(
          data.message ||
          "無法辨識此圖片"
        );


      } catch (err) {

        console.error(
          "匯入圖片辨識失敗:",
          err
        );


        setScannedResults(
          []
        );


        setScanPhase(
          "IDLE"
        );


        alert(
          "圖片辨識失敗，請確認後端是否正常運作"
        );


      } finally {

        event.target.value =
          "";
      }
    };



  const returnToCamera =
    () => {

      if (
        uploadedImagePreview
      ) {

        URL.revokeObjectURL(
          uploadedImagePreview
        );
      }


      setUploadedImagePreview(
        null
      );


      setScannedResults(
        []
      );


      setScanPhase(
        "IDLE"
      );
    };



  const handleCameraButton =
    () => {

      if (
        uploadedImagePreview
      ) {

        returnToCamera();

        return;
      }


      doScan();
    };




  const _handleSelectProduct = (
    item
  ) => {

    const payload = {

      ...item,

      quantity: 1,

    };


    addItemToCart(
      payload
    );


    setLastAddedItem(
      payload
    );


    setScannedResults(
      []
    );


    setScanPhase(
      "IDLE"
    );
  };










  useEffect(() => {

    return () => {

      if (
        uploadedImagePreview
      ) {

        URL.revokeObjectURL(
          uploadedImagePreview
        );
      }

    };

  }, [
    uploadedImagePreview
  ]);

  // 購物車列表用的圖片網址（舊後端路徑轉成 /photo/）
  const cartImgSrc = (url) =>
    url.startsWith("http")
      ? url
      : url.replace("/uploads/product_photos/", "/photo/");

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const scanning = scanPhase === "SCANNING";

  // 辨識結果只顯示這次拍照辨識到的商品：
  // 購物車裡手動加入的 (isManual) 不算；但如果這次辨識到的商品剛好也手動加過，仍顯示
  const scannedIds = new Set(
    (scannedResults || []).map((r) => String(r?.id ?? r?.product_id ?? r?.name))
  );
  const resultItems = cart.filter((item) =>
    scannedIds.has(String(item.id ?? item.product_id ?? item.name))
  );

  // 回到相機再拍一次，這次的結果保留在購物車
  const continueScanning = () => {
    setScanPhase("IDLE");
    setScanData(null);
    setUploadedImagePreview(null);
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)] gap-5">

      {/* ===================================================
          左：相機（或辨識結果）
      ==================================================== */}

      {scanPhase !== "RESULT" || developerMode ? (
        <section
          aria-label="相機畫面"
          className="relative min-h-0 min-w-0 bg-cocoa border-[3px] border-ink rounded-[28px] shadow-press-lg overflow-hidden"
        >
          {/* 16:9 畫面在區塊內取最大，ROI 百分比座標才會對齊實際影像 */}
          <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
            <div className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))]">

              {uploadedImagePreview ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={uploadedImagePreview}
                    alt="上傳商品預覽"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-4 left-4 z-20 bg-cocoa/80 text-cream px-3 py-1.5 rounded-full text-xs">
                    電腦匯入圖片
                  </div>
                </div>
              ) : (
                <CameraView
                  bare
                  mode="external"
                  videoRef={scanVideoRef}
                  onReadyChange={setCamReady}
                  onErrorChange={setCamError}
                />
              )}

              {!developerMode && scanning && (
                <div className="absolute inset-0 bg-cocoa/60 flex items-center justify-center z-30">
                  <div className="bg-paper border-[3px] border-ink px-6 py-3 rounded-2xl font-display text-xl text-ink">
                    辨識中...
                  </div>
                </div>
              )}

              {/* ROI Overlay (微調校正模式) */}
              {developerMode && (
                <RoiEditor
                  regions={activeRoiRegions}
                  onChange={(newRegions) => {
                    setCustomRoiLayouts((prev) => {
                      const next = { ...prev, [roiCount]: newRegions };
                      localStorage.setItem("tribal_custom_rois", JSON.stringify(next));
                      return next;
                    });
                  }}
                />
              )}

              {/* ROI 擺放導引框 */}
              {!developerMode && scanMode === "roi" && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {activeRoiRegions.map((region) => (
                    <div
                      key={region.id}
                      style={{
                        left: `${region.x1 * 100}%`,
                        top: `${region.y1 * 100}%`,
                        width: `${(region.x2 - region.x1) * 100}%`,
                        height: `${(region.y2 - region.y1) * 100}%`,
                      }}
                      className="absolute border-4 border-peach bg-peach/10 rounded-[20px]"
                    >
                      <span className="absolute -left-1 -bottom-1 bg-peach text-ink rounded-[12px_12px_12px_18px] px-3.5 py-1.5 text-[17px] font-bold">
                        商品 {region.id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 上方浮動列：返回 / 模式切換 / 鏡頭狀態 */}
          <div className="absolute left-4 right-4 top-4 z-40 flex items-center justify-between gap-3">
            {developerMode ? (
              <div className="chipbtn cursor-default bg-peach">
                ROI 微調模式（{roiCount} 件）
              </div>
            ) : (
              <BackButton to="/instruction" variant="chip" label="返回操作說明" />
            )}

            {!developerMode && (
              <div className="flex items-center gap-2">
                <div className="seg" role="group" aria-label="辨識模式">
                  <button
                    type="button"
                    onClick={() => handleModeChange("auto")}
                    aria-pressed={scanMode === "auto"}
                    className={scanMode === "auto" ? "seg-on" : ""}
                  >
                    自動辨識
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange("roi")}
                    aria-pressed={scanMode === "roi"}
                    className={scanMode === "roi" ? "seg-on" : ""}
                  >
                    ROI 區域模式
                  </button>
                </div>

                {scanMode === "roi" && (
                  <div className="seg" role="group" aria-label="預計件數">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleRoiCountChange(num)}
                        aria-pressed={roiCount === num}
                        className={roiCount === num ? "seg-on" : ""}
                      >
                        {num} 件
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="chipbtn cursor-default">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  uploadedImagePreview || camReady
                    ? "bg-forest"
                    : camError
                    ? "bg-rust"
                    : "bg-peach animate-pulse"
                }`}
              />
              {uploadedImagePreview
                ? "電腦匯入圖片"
                : camReady
                ? "鏡頭已就緒"
                : camError
                ? "鏡頭無法使用"
                : "鏡頭啟動中"}
            </div>
          </div>

          {/* 辨識失敗提示 */}
          {!developerMode && scanError && !scanning && (
            <div
              role="alert"
              className="absolute left-1/2 -translate-x-1/2 top-20 z-40 w-[min(560px,calc(100%-32px))] bg-peach border-[3px] border-ink rounded-[20px] px-5 py-4 flex flex-col gap-3"
            >
              <div className="font-display text-2xl">辨識失敗</div>
              <p className="text-lg leading-relaxed">{scanError}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/products")}
                  className="btn-press focus-ring h-12 px-5 bg-forest text-paper text-lg"
                >
                  手動選擇商品
                </button>
                <button
                  type="button"
                  onClick={() => setScanError("")}
                  className="btn-ghost focus-ring h-12 px-5 bg-paper"
                >
                  關閉
                </button>
              </div>
            </div>
          )}

          {/* 已加入提示 */}
          {!developerMode && lastAddedItem && (
            <div className="absolute left-1/2 -translate-x-1/2 top-20 z-40 bg-moss border-[3px] border-ink rounded-full px-5 py-2 text-ink text-base font-bold">
              ✓ 已加入：{lastAddedItem.name}
            </div>
          )}

          {/* 下方：拍照辨識（或微調控制） */}
          <div className="absolute left-4 right-4 bottom-[26px] z-40 flex items-end justify-center">
            {developerMode ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCustomRoiLayouts((prev) => {
                      const next = { ...prev, [roiCount]: DEFAULT_ROI_LAYOUTS[roiCount] };
                      localStorage.setItem("tribal_custom_rois", JSON.stringify(next));
                      return next;
                    });
                    alert(`已將 ${roiCount} 件模式的框線恢復為預設位置！`);
                  }}
                  className="btn-ghost focus-ring h-[72px] px-7 text-lg rounded-full"
                >
                  ↺ 重設為預設框線
                </button>
                <button
                  type="button"
                  onClick={() => setDeveloperMode(false)}
                  className="btn-press focus-ring h-[72px] px-9 bg-forest text-paper text-2xl rounded-full"
                >
                  ✓ 完成微調
                </button>
              </div>
            ) : (
              <button
                onClick={handleCameraButton}
                disabled={scanning}
                className={`btn-press focus-ring w-[340px] h-[84px] gap-3 rounded-full text-[32px] ${
                  uploadedImagePreview ? "bg-paper text-ink" : "bg-clay text-paper"
                }`}
              >
                <CameraIcon size={34} />
                {scanning ? "辨識中..." : uploadedImagePreview ? "返回相機" : "拍照辨識"}
              </button>
            )}

            {/* 左下：開發 / 測試用工具 */}
            {!developerMode && (
              <div className="absolute left-0 bottom-0 flex flex-col items-start gap-2">
                {scanMode === "roi" && (
                  <button
                    type="button"
                    onClick={() => setDeveloperMode(true)}
                    disabled={scanning}
                    className="chipbtn focus-ring"
                  >
                    微調框線
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      ) : (

        /* =================================================
            辨識結果 (多商品數量聚合與觸控加減微調)
        ================================================== */

        <section className="panel rounded-[28px] min-h-0 min-w-0 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b-2 border-sand shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[34px] text-ink">辨識結果</h1>
              {scanData?.total_objects_detected !== undefined && (
                <span className="chip bg-moss text-ink text-xl px-4 py-1.5">
                  偵測到 {scanData.total_objects_detected} 件物品
                </span>
              )}
              {scanData?.unrecognized_count > 0 && (
                <span className="chip bg-peach text-rust text-xl px-4 py-1.5">
                  {scanData.unrecognized_count} 件未辨識
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // 這次辨識不算：把這次加進購物車的數量和照片撤掉再重拍
                  if (currentScanId !== null) removeScan(currentScanId);
                  setCurrentScanId(null);
                  continueScanning();
                }}
                title="這次的辨識結果不要，重新拍一次"
                className="btn-press focus-ring h-12 px-5 bg-clay text-paper text-lg gap-2"
              >
                <CameraIcon size={22} />
                重新拍照
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  setScanData(null);
                  setScanPhase("IDLE");
                  setUploadedImagePreview(null);
                }}
                className="btn-ghost focus-ring h-12 px-4 hover:bg-peach hover:text-rust"
                title="清空目前購物車並重新開始"
              >
                清空
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 min-h-0 flex flex-col">
            {resultItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-ink/50 gap-3">
                <CartIcon size={56} />
                <p className="text-lg font-medium">這次沒有辨識到商品</p>
              </div>
            ) : (
              <div className="my-auto flex flex-wrap justify-center gap-5 p-0.5 pb-2">
                {resultItems.map((item) => (
                  <div
                    key={item.id ?? item.product_id ?? item.name}
                    data-testid={`cart-card-${item.name}`}
                    className="w-[calc((100%-2.5rem)/3)] bg-paper border-[3px] border-ink rounded-[22px] shadow-press overflow-hidden flex flex-col"
                  >
                    <div className="h-[240px] bg-wheat border-b-[3px] border-ink flex items-center justify-center p-3 shrink-0">
                      {item.image_url ? (
                        <img
                          src={cartImgSrc(item.image_url)}
                          alt={item.name}
                          className="max-w-full max-h-full object-contain rounded-md"
                        />
                      ) : (
                        <CartIcon size={40} />
                      )}
                    </div>

                    <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="font-bold text-2xl truncate" title={item.name}>{item.name}</span>
                        <span className="font-display text-[30px] text-rust shrink-0">NT${item.price}</span>
                      </div>

                      <div className="self-start flex items-center gap-2 bg-wheat rounded-full p-1.5">
                        <button
                          type="button"
                          data-testid={`btn-dec-${item.name}`}
                          onClick={() => decreaseQty(item.id ?? item.product_id)}
                          className={stepClassLg}
                          aria-label="減少數量"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center font-display text-[28px] select-none">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          data-testid={`btn-inc-${item.name}`}
                          onClick={() => increaseQty(item.id ?? item.product_id)}
                          className={stepClassLg}
                          aria-label="增加數量"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 隱藏圖片 Input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* ===================================================
          右：購物車清單 → 前往結帳 → 手動選擇
      ==================================================== */}

      <aside className="flex flex-col gap-3.5 min-h-0">
        <section className="panel rounded-3xl flex-1 min-h-0 px-4 pt-4 pb-3.5 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[26px]">購物車</h2>
            <span className="text-base font-bold">共 {cartCount} 件</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-ink/50 text-center px-4">
                <CartIcon size={40} />
                <p className="text-base">拍照辨識後，商品會出現在這裡</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id ?? item.product_id ?? item.name}
                  className="flex items-center gap-2.5 bg-cream rounded-[14px] py-2 pl-2 pr-3"
                >
                  <div className="w-12 h-12 shrink-0 rounded-[10px] border-2 border-sand bg-paper overflow-hidden flex items-center justify-center">
                    {item.image_url ? (
                      <img
                        src={cartImgSrc(item.image_url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <CartIcon size={24} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[17px] truncate">{item.name}</div>
                    <div className="text-sm">×{item.quantity}</div>
                  </div>
                  <div className="font-display text-[19px] text-rust shrink-0">
                    NT${item.price * item.quantity}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between items-baseline border-t-2 border-dashed border-sand pt-2.5">
            <span className="text-[17px] font-bold">小計</span>
            <span className="font-display text-[34px] text-forest">NT${totalAmount}</span>
          </div>
        </section>

        {scanPhase === "RESULT" && (
          <button
            type="button"
            onClick={continueScanning}
            className="btn-press focus-ring h-[64px] shrink-0 gap-2.5 bg-clay text-paper text-[22px]"
          >
            <CameraIcon size={26} />
            繼續拍照辨識
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/cart")}
          disabled={cart.length === 0}
          className="btn-press focus-ring h-[72px] shrink-0 gap-3 bg-forest text-paper text-[26px]"
        >
          前往結帳
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => navigate("/products")}
          className="focus-ring h-[60px] shrink-0 rounded-2xl border-[3px] border-forest bg-paper text-forest font-bold text-[19px] inline-flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          辨識不到？手動選擇商品
        </button>
      </aside>
    </div>
  );
}
