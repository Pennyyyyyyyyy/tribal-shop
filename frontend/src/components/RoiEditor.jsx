import React, {
  useRef,
  useState,
} from "react";


const MIN_SIZE = 0.05;


export default function RoiEditor({
  regions,
  onChange,
}) {

  const containerRef = useRef(null);

  const [action, setAction] =
    useState(null);


  // ============================================================
  // 限制數值範圍
  // ============================================================

  const clamp = (
    value,
    min,
    max
  ) => {

    return Math.min(
      Math.max(value, min),
      max
    );
  };


  // ============================================================
  // 開始拖曳 / 縮放
  // ============================================================

  const startAction = (
    event,
    roi,
    type
  ) => {

    event.preventDefault();
    event.stopPropagation();

    if (!containerRef.current) {
      return;
    }

    // 鎖定這根手指 / 滑鼠，拖出框外也繼續收到移動事件
    containerRef.current.setPointerCapture?.(
      event.pointerId
    );

    const rect =
      containerRef.current
        .getBoundingClientRect();


    const mouseX =
      (event.clientX - rect.left)
      / rect.width;

    const mouseY =
      (event.clientY - rect.top)
      / rect.height;


    setAction({

      roiId: roi.id,

      type,

      startMouseX: mouseX,

      startMouseY: mouseY,

      startROI: {
        ...roi,
      },

    });
  };


  // ============================================================
  // 拖曳 / 縮放中
  // ============================================================

  const handleMouseMove = (
    event
  ) => {

    if (!action) {
      return;
    }

    if (!containerRef.current) {
      return;
    }


    const rect =
      containerRef.current
        .getBoundingClientRect();


    const mouseX =
      (event.clientX - rect.left)
      / rect.width;

    const mouseY =
      (event.clientY - rect.top)
      / rect.height;


    const dx =
      mouseX -
      action.startMouseX;

    const dy =
      mouseY -
      action.startMouseY;


    const start =
      action.startROI;


    const updated =
      regions.map((roi) => {

        if (
          roi.id !==
          action.roiId
        ) {

          return roi;
        }


        let x1 =
          start.x1;

        let y1 =
          start.y1;

        let x2 =
          start.x2;

        let y2 =
          start.y2;


        // ======================================================
        // 移動整個 ROI
        // ======================================================

        if (
          action.type ===
          "move"
        ) {

          const width =
            start.x2 -
            start.x1;

          const height =
            start.y2 -
            start.y1;


          let newX1 =
            start.x1 + dx;

          let newY1 =
            start.y1 + dy;


          newX1 =
            clamp(
              newX1,
              0,
              1 - width
            );

          newY1 =
            clamp(
              newY1,
              0,
              1 - height
            );


          x1 = newX1;

          y1 = newY1;

          x2 =
            newX1 + width;

          y2 =
            newY1 + height;
        }


        // ======================================================
        // 左上角
        // ======================================================

        if (
          action.type ===
          "tl"
        ) {

          x1 =
            clamp(
              start.x1 + dx,
              0,
              start.x2 -
                MIN_SIZE
            );

          y1 =
            clamp(
              start.y1 + dy,
              0,
              start.y2 -
                MIN_SIZE
            );
        }


        // ======================================================
        // 右上角
        // ======================================================

        if (
          action.type ===
          "tr"
        ) {

          x2 =
            clamp(
              start.x2 + dx,
              start.x1 +
                MIN_SIZE,
              1
            );

          y1 =
            clamp(
              start.y1 + dy,
              0,
              start.y2 -
                MIN_SIZE
            );
        }


        // ======================================================
        // 左下角
        // ======================================================

        if (
          action.type ===
          "bl"
        ) {

          x1 =
            clamp(
              start.x1 + dx,
              0,
              start.x2 -
                MIN_SIZE
            );

          y2 =
            clamp(
              start.y2 + dy,
              start.y1 +
                MIN_SIZE,
              1
            );
        }


        // ======================================================
        // 右下角
        // ======================================================

        if (
          action.type ===
          "br"
        ) {

          x2 =
            clamp(
              start.x2 + dx,
              start.x1 +
                MIN_SIZE,
              1
            );

          y2 =
            clamp(
              start.y2 + dy,
              start.y1 +
                MIN_SIZE,
              1
            );
        }


        return {

          ...roi,

          x1,
          y1,
          x2,
          y2,

        };
      });


    onChange(updated);
  };


  // ============================================================
  // 結束拖曳
  // ============================================================

  const stopAction = () => {

    setAction(null);
  };


  // ============================================================
  // UI
  // ============================================================

  return (

    <div
      ref={containerRef}

      className="
        absolute
        inset-0
        z-30
        select-none
        touch-none
      "

      onPointerMove={
        handleMouseMove
      }

      onPointerUp={
        stopAction
      }

      onPointerCancel={
        stopAction
      }
    >

      {regions.map(
        (roi) => {

          const left =
            roi.x1 * 100;

          const top =
            roi.y1 * 100;

          const width =
            (
              roi.x2 -
              roi.x1
            ) * 100;

          const height =
            (
              roi.y2 -
              roi.y1
            ) * 100;


          return (

            <div
              key={roi.id}

              className="
                absolute
                border-2
                border-peach
                bg-peach/15
                cursor-move
              "

              style={{

                left:
                  `${left}%`,

                top:
                  `${top}%`,

                width:
                  `${width}%`,

                height:
                  `${height}%`,

              }}

              onPointerDown={
                (event) =>
                  startAction(
                    event,
                    roi,
                    "move"
                  )
              }
            >

              {/* ROI 名稱 */}

              <div
                className="
                  absolute
                  top-2
                  left-2
                  bg-peach
                  text-ink
                  px-2
                  py-1
                  rounded-lg
                  text-xs
                  font-bold
                  shadow
                  pointer-events-none
                "
              >

                {roi.name}

              </div>


              {/* 左上 */}

              <div
                className="
                  absolute
                  -left-[22px]
                  -top-[22px]
                  w-11
                  h-11
                  flex
                  items-center
                  justify-center
                  cursor-nwse-resize
                  z-40
                "

                onPointerDown={
                  (event) =>
                    startAction(
                      event,
                      roi,
                      "tl"
                    )
                }
              >
                <span className="w-[22px] h-[22px] bg-paper border-2 border-ink rounded-full pointer-events-none" />
              </div>


              {/* 右上 */}

              <div
                className="
                  absolute
                  -right-[22px]
                  -top-[22px]
                  w-11
                  h-11
                  flex
                  items-center
                  justify-center
                  cursor-nesw-resize
                  z-40
                "

                onPointerDown={
                  (event) =>
                    startAction(
                      event,
                      roi,
                      "tr"
                    )
                }
              >
                <span className="w-[22px] h-[22px] bg-paper border-2 border-ink rounded-full pointer-events-none" />
              </div>


              {/* 左下 */}

              <div
                className="
                  absolute
                  -left-[22px]
                  -bottom-[22px]
                  w-11
                  h-11
                  flex
                  items-center
                  justify-center
                  cursor-nesw-resize
                  z-40
                "

                onPointerDown={
                  (event) =>
                    startAction(
                      event,
                      roi,
                      "bl"
                    )
                }
              >
                <span className="w-[22px] h-[22px] bg-paper border-2 border-ink rounded-full pointer-events-none" />
              </div>


              {/* 右下 */}

              <div
                className="
                  absolute
                  -right-[22px]
                  -bottom-[22px]
                  w-11
                  h-11
                  flex
                  items-center
                  justify-center
                  cursor-nwse-resize
                  z-40
                "

                onPointerDown={
                  (event) =>
                    startAction(
                      event,
                      roi,
                      "br"
                    )
                }
              >
                <span className="w-[22px] h-[22px] bg-paper border-2 border-ink rounded-full pointer-events-none" />
              </div>

            </div>
          );
        }
      )}

    </div>
  );
}