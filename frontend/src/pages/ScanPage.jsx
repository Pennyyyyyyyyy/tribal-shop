import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";

import { useNavigate } from "react-router-dom";
import { useCheckout } from "../context/CheckoutContext";
import CameraView from "../components/CameraView";
import RoiEditor from "../components/RoiEditor";
import CheckoutCartEditor from "../components/CheckoutCartEditor";
import { useVoiceInstruction } from "../hooks/useVoiceInstruction";


const isE2E =
  typeof window !== "undefined" &&
  new URLSearchParams(
    window.location.search
  ).get("e2e") === "true";


export default function ScanPage() {

  const navigate = useNavigate();

  const {
    products,
    cart,
    setCart,
    addItemToCart,
    totalAmount,
    API_BASE_URL,
  } = useCheckout();


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


    console.log(
      "呼叫 Vision API:",
      `${API_BASE_URL}/vision/scan-table`
    );


    let resp;
    try {
      resp = await fetch(
        `${API_BASE_URL}/vision/scan-table`,
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


    setScannedResults(
      []
    );



    if (isE2E) {

      const base =
        products
          .slice(0, 3)
          .map((p) => ({

            ...p,

            quantity: 1,

            confidence: 0.5,

            isMock: true,

          }));


      setScannedResults(
        base
      );


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



        if (data.status === "success") {
          if (Array.isArray(data.cart_items) && (data.cart_items.length > 0 || data.total_objects_detected > 0)) {
            setScanData(data);
            setScannedResults(data.cart_items);
            setScanPhase("RESULT");
            return;
          }
          if (Array.isArray(data.predictions) && data.predictions.length > 0) {
            const results = data.predictions.map((item) => ({
              ...item,
              product_id: String(item.id || item.product_id),
              quantity: 1,
              isMock: false,
            }));
            setScanData({
              cart_items: results,
              total_objects_detected: results.length,
              unrecognized_count: 0,
            });
            setScannedResults(results);
            setScanPhase("RESULT");
            return;
          }
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

          quantity: 1,

          confidence: 0.5,

          isMock: true,

        }));


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


        if (data.status === "success") {
          if (Array.isArray(data.cart_items) && (data.cart_items.length > 0 || data.total_objects_detected > 0)) {
            setScanData(data);
            setScannedResults(data.cart_items);
            setScanPhase("RESULT");
            return;
          }
          if (Array.isArray(data.predictions) && data.predictions.length > 0) {
            const results = data.predictions.map((item) => ({
              ...item,
              product_id: String(item.id || item.product_id),
              quantity: 1,
              isMock: false,
            }));
            setScanData({
              cart_items: results,
              total_objects_detected: results.length,
              unrecognized_count: 0,
            });
            setScannedResults(results);
            setScanPhase("RESULT");
            return;
          }
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




  const handleSelectProduct = (
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
      className="
        w-full
        flex-1
        min-h-0
        bg-slate-50
        overflow-auto
      "
    >

      <div
        className="
          w-full
          max-w-6xl
          mx-auto
          min-h-full
          p-4
          md:p-6
          flex
          flex-col
          gap-4
        "
      >


        {/* ===================================================
            主卡片
        ==================================================== */}

        <div
          className="
            flex-1
            min-h-0
            bg-white
            border
            border-slate-200
            rounded-[28px]
            shadow-sm
            p-5
            md:p-7
            flex
            flex-col
            gap-5
          "
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
                className="
                  text-2xl
                  md:text-3xl
                  font-black
                  text-slate-800
                "
              >

                {
                  developerMode

                    ? "ROI 辨識區校正"

                    : scanPhase ===
                      "RESULT"

                    ? "辨識結果"

                    : "商品掃描"
                }

              </h1>


              <p
                className="
                  mt-2
                  text-sm
                  md:text-base
                  text-slate-500
                "
              >

                {
                  developerMode

                    ? "拖曳辨識框調整位置，拖曳四角調整大小，完成後請儲存設定。"

                    : scanPhase ===
                      "RESULT"

                    ? "確認辨識結果後，點選商品即可加入購物車。"

                    : uploadedImagePreview

                    ? "目前顯示從電腦匯入的照片。"

                    : "請將商品放入辨識區，再按下拍照辨識。"
                }

              </p>

            </div>


            {/* ROI 開發者按鈕 */}

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

              className={`
                shrink-0
                px-4
                py-2.5
                rounded-xl
                border
                text-sm
                font-bold
                transition-all

                ${
                  developerMode

                    ? "bg-amber-100 border-amber-300 text-amber-700"

                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }

                ${
                  scanPhase ===
                  "SCANNING"

                    ? "opacity-50 cursor-not-allowed"

                    : ""
                }
              `}
            >

              {
                developerMode

                  ? "✕ 離開 ROI 校正"

                  : "⚙ ROI 校正"
              }

            </button>

          </div>


          {/* =================================================
              已加入提示
          ================================================== */}

          {!developerMode &&
            lastAddedItem && (

            <div
              className="
                shrink-0
                bg-emerald-50
                border
                border-emerald-200
                rounded-xl
                px-4
                py-3
                text-emerald-800
                text-sm
              "
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
                    className="
                      relative
                      w-full
                      aspect-video
                      bg-black
                      rounded-[26px]
                      overflow-hidden
                      border
                      border-slate-700
                      shadow-xl
                    "
                  >


                    {/* =========================================
                        上傳圖片
                    ========================================== */}

                    {
                      uploadedImagePreview

                      ? (

                        <div
                          className="
                            absolute
                            inset-0
                            flex
                            items-center
                            justify-center
                            bg-black
                          "
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
                                className="
                                  absolute
                                  inset-0
                                  bg-black/50
                                  flex
                                  items-center
                                  justify-center
                                  z-20
                                "
                              >

                                <div
                                  className="
                                    bg-white
                                    px-6
                                    py-3
                                    rounded-2xl
                                    font-bold
                                    text-slate-800
                                    shadow-xl
                                  "
                                >

                                  辨識中...

                                </div>

                              </div>

                            )
                          }


                          <div
                            className="
                              absolute
                              bottom-4
                              left-4
                              z-20
                              bg-black/60
                              text-white
                              px-3
                              py-1.5
                              rounded-full
                              text-xs
                            "
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
                        ROI Overlay
                    ========================================== */}

                    {
                      developerMode &&
                      roiRegions.length ===
                        6 && (

                        <RoiEditor

                          regions={
                            roiRegions
                          }

                          onChange={
                            setRoiRegions
                          }

                        />

                      )
                    }


                    {/* =========================================
                        ROI 模式標示
                    ========================================== */}

                    {
                      developerMode && (

                        <div
                          className="
                            absolute
                            top-4
                            right-4
                            z-50
                            bg-amber-500
                            text-white
                            px-3
                            py-1.5
                            rounded-full
                            text-xs
                            font-bold
                            shadow-lg
                            pointer-events-none
                          "
                        >

                          ROI 校正模式

                        </div>

                      )
                    }

                  </div>

                </div>


                {/* =============================================
                    ROI 模式控制
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

                        onClick={
                          resetROIConfig
                        }

                        className="
                          px-6
                          py-3
                          rounded-xl
                          bg-slate-100
                          border
                          border-slate-200
                          text-slate-700
                          font-bold
                          hover:bg-slate-200
                          transition-all
                        "
                      >

                        ↺ 重設 2 × 3

                      </button>


                      <button

                        type="button"

                        onClick={
                          saveROIConfig
                        }

                        disabled={
                          roiSaving
                        }

                        className="
                          px-8
                          py-3
                          rounded-xl
                          bg-emerald-600
                          text-white
                          font-bold
                          shadow-sm
                          hover:bg-emerald-700
                          disabled:opacity-50
                          transition-all
                        "
                      >

                        {
                          roiSaving

                            ? "儲存中..."

                            : "儲存 ROI 設定"
                        }

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

                        className={`
                          w-full
                          py-4
                          rounded-2xl
                          text-lg
                          md:text-xl
                          font-black
                          shadow-md
                          transition-all

                          ${
                            scanPhase ===
                            "SCANNING"

                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"

                              : uploadedImagePreview

                              ? "bg-sky-600 text-white hover:bg-sky-700"

                              : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99]"
                          }
                        `}
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

                          className={`
                            w-full
                            py-3
                            rounded-xl
                            border
                            font-bold
                            transition-all

                            ${
                              scanPhase ===
                              "SCANNING"

                                ? "bg-slate-100 text-slate-400 border-slate-200"

                                : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            }
                          `}
                        >

                          從電腦匯入照片

                        </button>


                        <button

                          onClick={() =>
                            navigate(
                              "/products"
                            )
                          }

                          className="
                            w-full
                            py-3
                            rounded-xl
                            bg-white
                            border
                            border-slate-200
                            font-bold
                            text-slate-600
                            hover:bg-slate-50
                            transition-all
                          "
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
                  辨識結果 (多商品數量聚合與觸控加減微調)
              ================================================== */

              <div
                className="
                  flex-1
                  min-h-0
                  flex
                  flex-col
                  gap-4
                  overflow-y-auto
                "
              >
                <CheckoutCartEditor
                  initialItems={
                    scanData?.cart_items ||
                    scannedResults.map((item) => ({
                      product_id: String(item.product_id || item.id),
                      name: item.name,
                      price: Number(item.price || 0),
                      image_url: item.image_url,
                      quantity: item.quantity || 1,
                    }))
                  }
                  totalDetectedCount={
                    scanData?.total_objects_detected ?? scannedResults.length
                  }
                  unrecognizedCount={
                    scanData?.unrecognized_count ?? 0
                  }
                  onRescan={() => {
                    setScanPhase("IDLE");
                    setScannedResults([]);
                    setScanData(null);
                    if (uploadedImagePreview) {
                      imageInputRef.current?.click();
                    }
                  }}
                  onProceedToPay={(finalItems, total) => {
                    const formatted = finalItems.map((item) => ({
                      id: item.product_id,
                      name: item.name,
                      price: Number(item.price),
                      quantity: Number(item.quantity),
                      image: item.image_url || "🛍️",
                      image_url: item.image_url,
                    }));
                    setCart(formatted);
                    navigate("/payment");
                  }}
                />

                <div className="flex justify-center gap-4 py-2">
                  <button
                    type="button"
                    onClick={() => navigate("/products")}
                    className="text-sm text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    📦 手動選擇其他商品
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={returnToCamera}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    📷 放棄並返回拍照
                  </button>
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

        <div
          className="
            shrink-0
            bg-white
            rounded-2xl
            border
            border-slate-200
            shadow-sm
            px-5
            py-3
            flex
            items-center
            justify-between
            gap-4
          "
        >

          <div
            className="
              flex
              items-center
              gap-4
            "
          >

            {/* Icon */}

            <div
              className="
                relative
                w-12
                h-12
                bg-slate-100
                rounded-xl
                flex
                items-center
                justify-center
                text-2xl
              "
            >

              🛒


              {
                cart.length > 0 && (

                  <span
                    className="
                      absolute
                      -top-2
                      -right-2
                      w-6
                      h-6
                      rounded-full
                      bg-red-500
                      border-2
                      border-white
                      text-white
                      text-xs
                      font-bold
                      flex
                      items-center
                      justify-center
                    "
                  >

                    {
                      cart.length
                    }

                  </span>

                )
              }

            </div>


            {/* 購物車資訊 */}

            <div>

              <div
                className="
                  text-xs
                  text-slate-400
                "
              >

                購物車

                <span
                  className="
                    ml-2
                    text-slate-500
                  "
                >

                  {
                    cart.length
                  }

                  {" "}件商品

                </span>

              </div>


              <div
                className="
                  flex
                  items-baseline
                  gap-2
                "
              >

                <span
                  className="
                    text-xs
                    text-slate-400
                  "
                >

                  總計

                </span>


                <span
                  className="
                    text-2xl
                    font-black
                    text-slate-800
                  "
                >

                  $
                  {
                    totalAmount
                  }

                </span>

              </div>

            </div>

          </div>


          {/* 查看清單 */}

          <button

            onClick={() =>
              navigate(
                "/cart"
              )
            }

            disabled={
              cart.length === 0
            }

            className={`
              shrink-0
              px-6
              py-3
              rounded-xl
              font-bold
              transition-all

              ${
                cart.length > 0

                  ? "bg-sky-500 text-white shadow-sm hover:bg-sky-600"

                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }
            `}
          >

            查看清單 →

          </button>

        </div>

      </div>

    </div>

  );
}