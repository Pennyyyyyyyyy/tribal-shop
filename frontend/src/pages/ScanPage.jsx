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
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";


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
    setScannedItems,
    increaseQty,
    decreaseQty,
    resetAll,
    totalAmount,
    API_BASE_URL,
  } = useCheckout();


  const [
    scanPhase,
    setScanPhase,
  ] = useState("IDLE");


  const [
    _scannedResults,
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
  const [scanMode, setScanMode] = useState(
    () => localStorage.getItem("tribal_scan_mode") || "auto"
  );

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
    localStorage.setItem("tribal_scan_mode", mode);
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

    setScannedResults(
      []
    );



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

      setScannedItems(base);
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

          // 採用 setScannedItems 取代舊的掃描累積，避免重複吃到歷史紀錄
          setScannedItems(itemsToAdd);

          setScanData(data);
          setScannedResults(itemsToAdd);
          setScanPhase("RESULT");
          return;
        }


        console.warn(
          "後端沒有回傳有效 predictions:",
          data
        );


      } catch (err) {

        console.warn(
          "API 失敗，切換至備用模式",
          err
        );
      }
    }



    const fallback =
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

    setScannedItems(fallback);
    setScanData({
      cart_items: fallback,
      total_objects_detected: fallback.length,
      unrecognized_count: 0,
    });
    setScannedResults(
      fallback
    );


    setScanPhase(
      "RESULT"
    );
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

          // 採用 setScannedItems 取代舊的掃描累積，避免重複吃到歷史紀錄
          setScannedItems(itemsToAdd);

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



  const commandsRef =
    useRef({});


  useEffect(() => {

    commandsRef.current = {


      "拍照": () => {

        if (
          developerMode
        ) {

          return;
        }


        if (
          uploadedImagePreview
        ) {

          returnToCamera();

          return;
        }


        if (
          scanPhase !==
          "SCANNING"
        ) {

          doScan();
        }
      },


      "辨識": () => {

        if (
          developerMode
        ) {

          return;
        }


        if (
          uploadedImagePreview
        ) {

          return;
        }


        if (
          scanPhase !==
          "SCANNING"
        ) {

          doScan();
        }
      },


      "重新辨識": () => {

        if (
          developerMode
        ) {

          return;
        }


        if (
          uploadedImagePreview
        ) {

          imageInputRef.current
            ?.click();

          return;
        }


        if (
          scanPhase ===
          "RESULT"
        ) {

          doScan();
        }
      },


      "結帳": () => {

        if (
          cart.length > 0
        ) {

          navigate(
            "/cart"
          );
        }
      },


      "查看清單": () => {

        if (
          cart.length > 0
        ) {

          navigate(
            "/cart"
          );
        }
      },

    };

  });




  // ==========================================================
  // 語音指示
  // ==========================================================

  useVoiceInstruction(
    developerMode
      ? "目前為辨識區校正模式"
      : scanPhase === "SCANNING"
      ? "正在辨識中，請稍候"
      : scanPhase === "RESULT"
      ? "辨識完成，請點選商品加入購物車，或重新辨識"
      : "請將商品放入辨識區，點擊拍照進行辨識",
    [scanPhase, developerMode]
  );



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

  return (

    <div
      className="w-full flex-1 min-h-0 overflow-auto"
    >

      <div
        className="w-full max-w-6xl mx-auto min-h-full flex flex-col gap-4"
      >


        {/* ===================================================
            主卡片
        ==================================================== */}

        <div
          className="panel flex-1 min-h-0 p-5 md:p-7 flex flex-col gap-5"
        >


          {/* =================================================
              Header
          ================================================== */}

          <div
            className="
              shrink-0
              flex
              flex-col
              sm:flex-row
              sm:items-start
              sm:justify-between
              gap-4
            "
          >

            <div>

              <h1
                className="font-display text-2xl md:text-3xl text-ink"
              >

                {
                  developerMode

                    ? `ROI 辨識區校正 (${roiCount} 件模式)`

                    : scanPhase ===
                      "RESULT"

                    ? "辨識結果"

                    : "商品掃描"
                }

              </h1>


              <p
                className="mt-2 text-sm md:text-base text-ink/60"
              >

                {
                  developerMode

                    ? `拖曳調整 ${roiCount} 個辨識框的位置與大小，完成後請點擊下方「完成校正」。`

                    : scanPhase ===
                      "RESULT"

                    ? "確認辨識結果後，點選商品即可加入購物車。"

                    : uploadedImagePreview

                    ? "目前顯示從電腦匯入的照片。"

                    : scanMode === "roi"

                    ? `ROI ${roiCount} 件模式：請將商品分別擺在相機畫面的 ${roiCount} 個導引框內，再按下辨識。`

                    : "自動分切模式：請將商品任意放置於桌面上（避免堆疊），再按下辨識。"
                }

              </p>

              {/* 模式切換與件數選擇 */}
              {!developerMode && scanPhase !== "RESULT" && (
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  {/* 模式切換 Tab */}
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange("auto")}
                      aria-pressed={scanMode === "auto"}
                      className={`pill focus-ring ${scanMode === "auto" ? "pill-on" : "hover:border-clay"}`}
                    >
                      自動辨識
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeChange("roi")}
                      aria-pressed={scanMode === "roi"}
                      className={`pill focus-ring ${scanMode === "roi" ? "pill-on" : "hover:border-clay"}`}
                    >
                      ROI 區域模式
                    </button>
                  </div>

                  {/* ROI 件數選擇 (僅在 ROI 模式顯示) */}
                  {scanMode === "roi" && (
                    <div className="inline-flex items-center gap-2">
                      <span className="text-sm font-bold text-ink/70 pl-1">
                        預計件數：
                      </span>
                      {[1, 2, 3].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleRoiCountChange(num)}
                          aria-pressed={roiCount === num}
                          className={`pill focus-ring ${
                            roiCount === num
                              ? "bg-clay border-ink text-paper"
                              : "hover:border-clay"
                          }`}
                        >
                          {num} 件
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>


            {/* ROI 開發者按鈕 (僅在 ROI 模式顯示) */}

            {scanMode === "roi" && (
              <button

                type="button"

                onClick={() => {

                  setDeveloperMode(
                    (prev) => !prev
                  );

                }}

                disabled={
                  scanPhase ===
                  "SCANNING"
                }

                className={`btn-ghost focus-ring shrink-0 h-11 px-4 text-sm ${
                  developerMode ? "bg-peach hover:bg-peach border-2 border-clay" : ""
                }`}
              >

                {
                  developerMode

                    ? "✕ 離開微調"

                    : "微調框線"
                }

              </button>
            )}

          </div>


          {/* =================================================
              已加入提示
          ================================================== */}

          {!developerMode &&
            lastAddedItem && (

            <div
              className="shrink-0 bg-moss/40 border-2 border-moss rounded-2xl px-4 py-3 text-ink text-sm"
            >

              ✓ 已加入：

              <b className="ml-1">

                {
                  lastAddedItem.name
                }

              </b>

            </div>

          )}


          {/* =================================================
              掃描 / ROI 校正畫面
          ================================================== */}

          {
            scanPhase !==
              "RESULT" ||
            developerMode

            ? (

              <div
                className="
                  flex-1
                  min-h-0
                  flex
                  flex-col
                  items-center
                  justify-center
                  gap-4
                "
              >


                {/* =============================================
                    Camera
                ============================================== */}

                <div
                  className="
                    w-full
                    max-w-4xl
                    flex
                    items-center
                    justify-center
                  "
                >

                  <div
                    className="relative w-full aspect-video bg-cocoa rounded-[22px] overflow-hidden border-[3px] border-ink"
                  >


                    {/* =========================================
                        上傳圖片
                    ========================================== */}

                    {
                      uploadedImagePreview

                      ? (

                        <div
                          className="absolute inset-0 flex items-center justify-center bg-cocoa"
                        >

                          <img

                            src={
                              uploadedImagePreview
                            }

                            alt="上傳商品預覽"

                            className="
                              w-full
                              h-full
                              object-contain
                            "

                          />


                          {
                            !developerMode &&
                            scanPhase ===
                              "SCANNING" && (

                              <div
                                className="absolute inset-0 bg-cocoa/60 flex items-center justify-center z-20"
                              >

                                <div
                                  className="bg-paper border-[3px] border-ink px-6 py-3 rounded-2xl font-display text-lg text-ink"
                                >

                                  辨識中...

                                </div>

                              </div>

                            )
                          }


                          <div
                            className="absolute bottom-4 left-4 z-20 bg-cocoa/80 text-cream px-3 py-1.5 rounded-full text-xs"
                          >

                            電腦匯入圖片

                          </div>

                        </div>

                      )

                      : (

                        <CameraView

                          fill

                          mode="external"

                          label="SCANNING"

                          status={

                            scanPhase ===
                            "SCANNING"

                              ? "SCANNING"

                              : "LIVE"

                          }

                          videoRef={
                            scanVideoRef
                          }

                        />

                      )
                    }


                    {/* =========================================
                        ROI Overlay (微調校正模式)
                    ========================================== */}

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

                    {/* =========================================
                        ROI 輔助導引框 (常駐擺放指引)
                    ========================================== */}
                    {!developerMode && scanMode === "roi" && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {activeRoiRegions.map((region) => {
                          const left = `${region.x1 * 100}%`;
                          const top = `${region.y1 * 100}%`;
                          const width = `${(region.x2 - region.x1) * 100}%`;
                          const height = `${(region.y2 - region.y1) * 100}%`;
                          return (
                            <div
                              key={region.id}
                              style={{ left, top, width, height }}
                              className="absolute border-[3px] border-dashed border-peach bg-peach/10 rounded-2xl flex flex-col justify-between p-3 transition-all duration-300"
                            >
                              <div className="inline-flex self-start items-center px-2.5 py-1 rounded-lg bg-peach text-ink text-xs font-bold">
                                <span>商品 {region.id}</span>
                              </div>
                              <div className="text-center text-xs text-cream font-bold bg-cocoa/70 py-1 px-3 rounded-lg self-center backdrop-blur-sm">
                                請將商品置於框內
                              </div>
                            </div>
                          );
                        })}

                        {/* 頂部引導指示牌 */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cocoa/85 text-peach border-2 border-peach/40 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-peach animate-ping" />
                          <span>ROI {roiCount} 件模式：請將商品分別放入上方框內</span>
                        </div>
                      </div>
                    )}


                    {/* =========================================
                        ROI 模式標示
                    ========================================== */}

                    {
                      developerMode && (

                        <div
                          className="absolute top-4 right-4 z-50 bg-peach border-2 border-ink text-ink px-3 py-1.5 rounded-full text-xs font-bold pointer-events-none"
                        >

                          ROI 微調模式 ({roiCount} 件)

                        </div>

                      )
                    }

                  </div>

                </div>


                {/* =============================================
                    ROI 模式控制 (微調模式)
                ============================================== */}

                {
                  developerMode

                  ? (

                    <div
                      className="
                        w-full
                        max-w-4xl
                        flex
                        flex-col
                        sm:flex-row
                        justify-end
                        gap-3
                      "
                    >

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
                        className="btn-ghost focus-ring h-12 px-6"
                      >
                        ↺ 重設為預設框線
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeveloperMode(false);
                        }}
                        className="btn-press focus-ring h-12 px-8 bg-forest text-paper text-lg"
                      >
                        ✓ 完成微調
                      </button>

                    </div>

                  )

                  : (

                    /* =========================================
                        一般操作
                    ========================================== */

                    <div
                      className="
                        w-full
                        max-w-4xl
                        flex
                        flex-col
                        gap-3
                      "
                    >


                      {/* 主要辨識 */}

                      <button

                        onClick={
                          handleCameraButton
                        }

                        disabled={
                          scanPhase ===
                          "SCANNING"
                        }

                        className={`btn-press focus-ring w-full h-16 text-2xl ${
                          scanPhase === "SCANNING"
                            ? "bg-sand text-ink"
                            : uploadedImagePreview
                            ? "bg-paper text-ink"
                            : "bg-clay text-paper"
                        }`}
                      >

                        {
                          scanPhase ===
                          "SCANNING"

                            ? "辨識中..."

                            : uploadedImagePreview

                            ? "返回相機"

                            : "拍照辨識"
                        }

                      </button>


                      {/* 第二排 */}

                      <div
                        className="
                          grid
                          grid-cols-1
                          sm:grid-cols-2
                          gap-3
                        "
                      >

                        <button

                          onClick={() =>
                            imageInputRef.current
                              ?.click()
                          }

                          disabled={
                            scanPhase ===
                            "SCANNING"
                          }

                          className="btn-ghost focus-ring w-full h-12 text-[17px]"
                        >

                          從電腦匯入照片

                        </button>


                        <button

                          onClick={() =>
                            navigate(
                              "/products"
                            )
                          }

                          className="btn-ghost focus-ring w-full h-12 text-[17px]"
                        >

                          手動選擇商品

                        </button>

                      </div>

                    </div>

                  )
                }

              </div>

            )

            : (

              /* =================================================
                  辨識結果 (多商品數量聚合與觸控加減微調，與 ProductSelectPage 風格一致)
              ================================================== */

              <div className="flex-1 min-h-0 flex flex-col gap-3">
                {/* 頂部辨識資訊與操作列 */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-sand shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xl text-ink">
                      辨識結果
                    </span>
                    {scanData?.total_objects_detected !== undefined && (
                      <span className="chip bg-moss text-ink">
                        偵測到 {scanData.total_objects_detected} 件物品
                      </span>
                    )}
                    {scanData?.unrecognized_count > 0 && (
                      <span className="chip bg-peach text-rust">
                        {scanData.unrecognized_count} 件未辨識
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScanPhase("IDLE");
                        setScanData(null);
                        setUploadedImagePreview(null);
                      }}
                      className="btn-ghost focus-ring h-11 px-4 text-sm"
                    >
                      重新拍照
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/products")}
                      className="btn-ghost focus-ring h-11 px-4 text-sm"
                    >
                      手動選擇商品
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetAll();
                        setScanData(null);
                        setScanPhase("IDLE");
                        setUploadedImagePreview(null);
                      }}
                      className="btn-ghost focus-ring h-11 px-4 text-sm hover:bg-peach hover:text-rust"
                      title="清空目前購物車並重新開始"
                    >
                      清空
                    </button>
                  </div>
                </div>

                {/* 商品卡片區 - 與 ProductSelectPage.jsx 完全一致的風格 */}
                <div
                  className="flex-1 overflow-y-scroll pr-3 min-h-0
                    [&::-webkit-scrollbar]:w-2
                    [&::-webkit-scrollbar-track]:bg-wheat
                    [&::-webkit-scrollbar-track]:rounded-full
                    [&::-webkit-scrollbar-thumb]:bg-sand
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    hover:[&::-webkit-scrollbar-thumb]:bg-clay"
                >
                  {cart.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-ink/50 gap-3">
                      <CartIcon size={56} />
                      <p className="text-base font-medium">購物車目前沒有商品</p>
                      <div className="flex gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScanPhase("IDLE");
                            setUploadedImagePreview(null);
                          }}
                          className="btn-press focus-ring h-12 px-5 bg-forest text-paper text-lg"
                        >
                          重新拍照
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/products")}
                          className="btn-ghost focus-ring h-12 px-5"
                        >
                          手動選擇商品
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {cart.map((item) => (
                        <div
                          key={item.id ?? item.product_id ?? item.name}
                          data-testid={`cart-card-${item.name}`}
                          className="w-44 flex-none bg-paper border-[3px] border-ink rounded-[22px] shadow-press overflow-hidden flex flex-col"
                        >
                          <div className="w-full h-44 bg-wheat border-b-[3px] border-ink flex items-center justify-center p-3 shrink-0">
                            {item.image_url ? (
                              <img
                                src={
                                  item.image_url.startsWith("http")
                                    ? item.image_url
                                    : item.image_url.replace(
                                        "/uploads/product_photos/",
                                        "/photo/"
                                      )
                                }
                                alt={item.name}
                                className="max-w-full max-h-full object-contain mx-auto"
                              />
                            ) : (
                              <span className="text-4xl">{item.image || "🛍️"}</span>
                            )}
                          </div>

                          <div className="p-3 flex flex-col gap-1.5">
                            <div
                              className="text-base font-bold text-ink truncate"
                              title={item.name}
                            >
                              {item.name}
                            </div>
                            <div className="font-display text-[22px] text-rust">
                              NT${item.price}
                            </div>

                            <div className="self-start flex items-center gap-1.5 mt-1 bg-wheat rounded-full p-1">
                              <button
                                type="button"
                                data-testid={`btn-dec-${item.name}`}
                                onClick={() => decreaseQty(item.id ?? item.product_id)}
                                className="focus-ring w-[34px] h-[34px] rounded-full bg-paper text-xl font-bold flex items-center justify-center active:scale-95 transition cursor-pointer select-none"
                                aria-label="減少數量"
                              >
                                −
                              </button>
                              <span className="min-w-6 text-center text-lg font-bold text-ink select-none">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                data-testid={`btn-inc-${item.name}`}
                                onClick={() => increaseQty(item.id ?? item.product_id)}
                                className="focus-ring w-[34px] h-[34px] rounded-full bg-paper text-xl font-bold flex items-center justify-center active:scale-95 transition cursor-pointer select-none"
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
              </div>

            )
          }

        </div>


        {/* ===================================================
            隱藏圖片 Input
        ==================================================== */}

        <input

          ref={
            imageInputRef
          }

          type="file"

          accept="image/*"

          onChange={
            handleImageUpload
          }

          className="hidden"

        />


        {/* ===================================================
            底部購物車
        ==================================================== */}

        <div className="panel shrink-0 flex items-center gap-4 py-3.5 pr-4 pl-7">
          <CartIcon />
          <span className="text-[17px]">購物車</span>
          <span className="font-display text-[30px]">
            {cart.length} 項 · NT${totalAmount}
          </span>

          {/* 右側按鈕群 */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate("/cart")}
              disabled={cart.length === 0}
              className="btn-ghost focus-ring h-16 px-6 text-xl"
            >
              查看清單
            </button>
            <button
              type="button"
              onClick={() => navigate("/payment")}
              disabled={cart.length === 0}
              className="btn-press focus-ring h-16 px-[34px] bg-clay text-paper text-[26px]"
            >
              前往結帳
            </button>
          </div>
        </div>

      </div>

    </div>

  );
}