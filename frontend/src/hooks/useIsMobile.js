// 後台依螢幕寬度切換電腦版 / 手機版。768px 以下（手機直放）走手機版，平板以上走電腦版。
import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

export function useIsMobile() {
    const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);

    useEffect(() => {
        const mql = window.matchMedia(QUERY);
        const onChange = e => setMobile(e.matches);
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    return mobile;
}
