"use strict";

(() => {
    // Run at the start of the body, before page stylesheets can delay rendering.
    const MINIMUM_DURATION = 1000;
    const RETRY_INTERVAL = 2000;
    const fetchResource = window.fetch.bind(window);
    const connectionUrl = new URL("../index.html", document.currentScript.src);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const el = document.createElement("div");
    el.id = "sf-loader";
    el.tabIndex = -1;
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", "جاري التحميل");
    el.innerHTML = '<div class="orbit" aria-hidden="true"></div>' +
        '<div class="txt">جاري التحميل...</div>' +
        '<div class="slow" aria-live="polite"></div>';
    document.body.prepend(el);

    const slow = el.querySelector(".slow");
    const orbit = el.querySelector(".orbit");
    const items = [
        { p: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16c.5-2 2-2.5 3.2-2.5s2.7.5 3.2 2.5M14 10h4M14 13.5h4"/>' },
        { p: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l.7-3h4.6L15 6M9 18l.7 3h4.6L15 18M12 10v2.5l1.5 1"/>' },
        { p: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18.5h2"/>' },
        { p: '<path d="M5 7V6a2 2 0 0 1 2-2h10v3"/><rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="16.5" cy="13.5" r="1.3" fill="currentColor"/>' },
        { p: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l2.5 2.5"/>' },
        { p: '<rect x="5" y="8" width="14" height="13" rx="4"/><path d="M9 8V6a3 3 0 0 1 6 0v2M8.5 14h7"/>' }
    ];
    const star = '<svg viewBox="0 0 24 24"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z"/></svg>';
    const N = items.length;
    const R = 68;
    const T = 2800;
    const PRE = .42;
    const TRAIL = [45, 90, 135];
    const SPARKS = 7;
    const STEPS = 200;
    const G = [0];

    for (let k = 1; k <= STEPS; k++) {
        const ph = k / STEPS;
        let m = 1;
        if (ph > PRE && ph < .88) {
            m = 1 - .62 * Math.sin(Math.PI * (ph - PRE) / (.88 - PRE));
        }
        G[k] = G[k - 1] + m / STEPS;
    }

    const GT = G[STEPS];
    const K = 180 / PRE;
    const els = items.map(item => {
        const node = document.createElement("div");
        node.className = "p";
        node.innerHTML = '<svg viewBox="0 0 24 24">' + item.p + '</svg>';
        orbit.appendChild(node);
        return node;
    });
    const trails = TRAIL.map(() => {
        const node = document.createElement("div");
        node.className = "tr";
        orbit.appendChild(node);
        return node;
    });
    const sparks = Array.from({ length: SPARKS }, () => {
        const node = document.createElement("div");
        node.className = "sp";
        node.innerHTML = star;
        orbit.appendChild(node);
        return node;
    });

    function clamp(x, a, b) {
        return Math.max(a, Math.min(b, x));
    }

    function Gf(ph) {
        const x = clamp(ph, 0, 1) * STEPS;
        const i = Math.floor(x);
        return i >= STEPS ? G[STEPS] : G[i] + (G[i + 1] - G[i]) * (x - i);
    }

    function eIO(x) {
        return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function eBack(x) {
        return 1 + 2.35 * Math.pow(x - 1, 3) + 1.35 * Math.pow(x - 1, 2);
    }

    function prog(ph) {
        if (ph < PRE) return 0;
        if (ph < .72) return eBack((ph - PRE) / (.72 - PRE));
        if (ph < .86) return 1;
        return 1 - eIO((ph - .86) / .14);
    }

    function antic(ph, p) {
        const a0 = PRE - .14;
        if (ph < a0) return 0;
        if (ph < PRE) return .28 * eIO((ph - a0) / .14);
        return .28 * Math.max(0, 1 - p);
    }

    function bump(ph) {
        return ph > .68 && ph < .90 ? .10 * Math.sin(Math.PI * (ph - .68) / .22) : 0;
    }

    function stateOf(i, tt, c, idx) {
        const ph = clamp((tt - c * T) / T, 0, 1);
        const p = prog(ph);
        const on = i === idx;
        const rot = (c * GT + Gf(ph)) * K;
        const a = (i * 360 / N + rot) * Math.PI / 180;
        const r = on ? R * (1 - p) : R * (1 - .06 * clamp(p, 0, 1) + bump(ph));
        return {
            x: Math.sin(a) * r,
            y: -Math.cos(a) * r,
            s: on ? 1 + 1.1 * p + antic(ph, p) : 1,
            ph,
            p
        };
    }

    let raf = null;
    let t0 = null;
    let lastIdx = -1;

    function frame(ts) {
        if (t0 === null) t0 = ts;
        const t = ts - t0;
        const c = Math.floor(t / T);
        const idx = c % N;
        let cur = null;

        if (idx !== lastIdx) {
            lastIdx = idx;
            const svg = '<svg viewBox="0 0 24 24">' + items[idx].p + '</svg>';
            trails.forEach(trail => { trail.innerHTML = svg; });
        }

        for (let i = 0; i < N; i++) {
            const state = stateOf(i, t, c, idx);
            const on = i === idx;
            let scale = state.s;
            let rotation = 0;
            let filter = "";
            if (on) {
                cur = state;
                if (state.ph >= .68 && state.ph < .88) {
                    rotation = 8 * Math.sin((state.ph - .68) * 42) * (1 - (state.ph - .68) / .20);
                }
                filter = 'drop-shadow(0 ' + (7 * state.p).toFixed(1) + 'px ' +
                    (5 * state.p).toFixed(1) + 'px rgba(10,54,108,' +
                    (.30 * clamp(state.p, 0, 1)).toFixed(2) + '))';
            } else {
                scale = 1 + .05 * Math.sin(t / 260 + i * 1.3);
            }
            els[i].style.transform = 'translate(' + state.x.toFixed(1) + 'px,' +
                state.y.toFixed(1) + 'px) rotate(' + rotation.toFixed(1) +
                'deg) scale(' + scale.toFixed(3) + ')';
            els[i].style.filter = filter;
            els[i].style.zIndex = on ? 3 : 1;
            els[i].classList.toggle("act", on && state.p > .5);
            els[i].classList.toggle("done", !on && i < idx);
        }

        const pp = clamp(cur.p, 0, 1);
        for (let i = 0; i < N; i++) {
            els[i].style.opacity = i === idx ? 1 : (i < idx ? .95 : .55) * (1 - .25 * pp);
        }

        TRAIL.forEach((delay, k) => {
            const state = stateOf(idx, Math.max(t - delay, c * T), c, idx);
            const dist = Math.hypot(state.x - cur.x, state.y - cur.y);
            trails[k].style.transform = 'translate(' + state.x.toFixed(1) + 'px,' +
                state.y.toFixed(1) + 'px) scale(' + (state.s * (1 - .1 * (k + 1))).toFixed(3) + ')';
            trails[k].style.opacity = (clamp(dist / 22, 0, 1) * (.32 - .09 * k)).toFixed(2);
        });

        const q = (cur.ph - .62) / .30;
        for (let k = 0; k < SPARKS; k++) {
            if (q > 0 && q < 1) {
                const ang = (k * 360 / SPARKS + 18) * Math.PI / 180;
                const dd = 10 + 40 * eIO(q) * (.7 + .3 * ((k % 3) / 2));
                const opacity = Math.sin(Math.PI * q);
                sparks[k].style.transform = 'translate(' + (Math.cos(ang) * dd).toFixed(1) +
                    'px,' + (Math.sin(ang) * dd).toFixed(1) + 'px) scale(' +
                    (.5 + .9 * opacity).toFixed(2) + ') rotate(' + (q * 120).toFixed(0) + 'deg)';
                sparks[k].style.opacity = (.95 * opacity).toFixed(2);
            } else {
                sparks[k].style.opacity = 0;
            }
        }

        raf = reducedMotion.matches ? null : requestAnimationFrame(frame);
    }

    function startAnim() {
        if (raf === null) {
            t0 = null;
            lastIdx = -1;
            raf = requestAnimationFrame(frame);
        }
    }

    function stopAnim() {
        if (raf !== null) {
            cancelAnimationFrame(raf);
            raf = null;
        }
    }

    let pending = 0;
    let shownAt = 0;
    let slowTimer;
    let stopTimer;
    let connectionPromise = null;
    let navigationPending = false;
    let finishNavigation = null;
    let previousFocus = null;
    const blockedElements = new Set();
    const failedResources = new Set();
    let pageLoaded = false;

    function blockPage() {
        for (const child of document.body.children) {
            if (child !== el && !child.inert) {
                child.inert = true;
                blockedElements.add(child);
            }
        }
    }

    function showLoader() {
        clearTimeout(stopTimer);
        if (!el.classList.contains("show")) {
            shownAt = performance.now();
            previousFocus = document.activeElement;
            slow.textContent = "";
            el.classList.add("show");
            el.setAttribute("aria-hidden", "false");
            document.body.setAttribute("aria-busy", "true");
            document.documentElement.classList.add("sf-loading");
            slowTimer = setTimeout(() => {
                slow.textContent = "الاتصال بطيء شوي، لحظات من فضلك...";
            }, 6000);
            el.focus({ preventScroll: true });
        }
        blockPage();
        startAnim();
    }

    function hideLoader() {
        clearTimeout(slowTimer);
        el.classList.remove("show");
        el.setAttribute("aria-hidden", "true");
        document.body.removeAttribute("aria-busy");
        document.documentElement.classList.remove("sf-loading");
        blockedElements.forEach(child => { child.inert = false; });
        blockedElements.clear();
        if (previousFocus?.isConnected && !previousFocus.inert) {
            previousFocus.focus({ preventScroll: true });
        }
        stopTimer = setTimeout(() => {
            if (!el.classList.contains("show")) stopAnim();
        }, 300);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitMinimum() {
        while (performance.now() - shownAt < MINIMUM_DURATION) {
            await delay(MINIMUM_DURATION - (performance.now() - shownAt));
        }
    }

    function begin() {
        pending++;
        showLoader();
        let finished = false;
        return async () => {
            if (finished) return;
            finished = true;
            await waitMinimum();
            pending--;
            if (pending === 0) hideLoader();
        };
    }

    function waitForRetry() {
        return new Promise(resolve => {
            const resume = () => {
                clearTimeout(timer);
                window.removeEventListener("online", resume);
                resolve();
            };
            const timer = setTimeout(resume, RETRY_INTERVAL);
            window.addEventListener("online", resume, { once: true });
        });
    }

    function waitForConnection() {
        if (!connectionPromise) {
            connectionPromise = (async () => {
                const finish = begin();
                try {
                    while (true) {
                        if (navigator.onLine) {
                            try {
                                const response = await fetchResource(connectionUrl, {
                                    cache: "no-store",
                                    credentials: "same-origin"
                                });
                                if (response.ok) return;
                                console.error("Connection check failed:", response.status);
                            } catch (error) {
                                if (!(error instanceof TypeError)) throw error;
                                console.warn("Waiting for the connection to return:", error);
                            }
                        }
                        await waitForRetry();
                    }
                } finally {
                    await finish();
                    connectionPromise = null;
                }
            })();
        }
        return connectionPromise;
    }

    class ConnectionError extends Error {
        constructor() {
            super("انقطع الاتصال أثناء الإرسال. تحقق من نتيجة العملية قبل المحاولة مجددًا؛ لم نعد إرسال الطلب تلقائيًا.");
            this.name = "ConnectionError";
        }
    }

    async function request(url, options = {}) {
        const finish = begin();
        const method = (options.method || "GET").toUpperCase();
        try {
            while (true) {
                if (!navigator.onLine || connectionPromise) await waitForConnection();
                try {
                    const response = await fetchResource(url, options);
                    const data = await response.json();
                    return { response, data };
                } catch (error) {
                    if (!(error instanceof TypeError) || options.signal?.aborted) throw error;
                    console.error("Request connection failed:", error);
                    await waitForConnection();
                    // A lost response does not prove that a write failed on the server.
                    if (method !== "GET" && method !== "HEAD") throw new ConnectionError();
                    await waitForRetry();
                }
            }
        } finally {
            await finish();
        }
    }

    async function navigate(url, { replace = false } = {}) {
        if (navigationPending) return;
        navigationPending = true;
        finishNavigation = begin();
        try {
            await waitForConnection();
            await waitMinimum();
            if (replace) {
                window.location.replace(url);
            } else {
                window.location.assign(url);
            }
        } catch (error) {
            navigationPending = false;
            await finishNavigation();
            finishNavigation = null;
            throw error;
        }
    }

    window.SFLoader = { request, navigate, ConnectionError };

    const finishPage = begin();

    window.addEventListener("error", event => {
        const target = event.target;
        const source = target instanceof HTMLImageElement && target.loading !== "lazy"
            ? target.currentSrc || target.src
            : target instanceof HTMLScriptElement ? target.src
            // A loaded stylesheet whose external @import failed still has a sheet; keep it.
            : target instanceof HTMLLinkElement && target.relList.contains("stylesheet") && !target.sheet ? target.href
            : null;
        if (!pageLoaded && source && new URL(source).origin === location.origin) {
            failedResources.add(source);
            console.error("Page resource failed to load:", source);
        }
    }, true);

    const bodyObserver = new MutationObserver(() => {
        if (el.classList.contains("show")) blockPage();
    });
    bodyObserver.observe(document.body, { childList: true });

    window.addEventListener("load", async () => {
        pageLoaded = true;
        await waitForConnection();
        document.querySelectorAll('link[rel~="stylesheet"]').forEach(link => {
            if (!link.sheet && new URL(link.href).origin === location.origin) {
                failedResources.add(link.href);
                console.error("Page stylesheet failed to load:", link.href);
            }
        });
        if (failedResources.size) {
            while (failedResources.size) {
                await Promise.all([...failedResources].map(async url => {
                    try {
                        const response = await fetchResource(url, { cache: "reload" });
                        if (response.ok) {
                            await response.arrayBuffer();
                            failedResources.delete(url);
                        } else {
                            console.error("Page resource retry failed:", url, response.status);
                        }
                    } catch (error) {
                        if (!(error instanceof TypeError)) throw error;
                        console.warn("Waiting to reload a page resource:", url, error);
                    }
                }));
                if (failedResources.size) await waitForRetry();
            }
            // Reload once so recovered scripts execute in their original order.
            window.location.reload();
            return;
        }
        await finishPage();
    }, { once: true });

    window.addEventListener("offline", () => { void waitForConnection(); });

    window.addEventListener("pageshow", async event => {
        if (!event.persisted) return;
        navigationPending = false;
        if (!navigator.onLine) void waitForConnection();
        if (finishNavigation) {
            await finishNavigation();
            finishNavigation = null;
        }
        if (el.classList.contains("show")) startAnim();
    });

    window.addEventListener("pagehide", stopAnim);

    reducedMotion.addEventListener("change", () => {
        stopAnim();
        if (el.classList.contains("show")) startAnim();
    });

    document.addEventListener("click", event => {
        if (event.defaultPrevented || event.button !== 0 ||
            event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const anchor = event.target.closest("a[href]");
        if (!anchor || anchor.hasAttribute("download") ||
            (anchor.target && anchor.target !== "_self")) return;
        const target = new URL(anchor.href);
        if (target.origin !== location.origin ||
            (target.pathname === location.pathname && target.search === location.search && target.hash)) return;
        event.preventDefault();
        void navigate(target.href);
    });
})();
