const CACHE_NAME = "tiktok-clone-v1";

const GITHUB_PAGES_BASE = "https://tongtrankien1605.github.io";
const REPOSITORY_ROOT = "/daohuyenmy-clone/";
const BASE_URL = GITHUB_PAGES_BASE + REPOSITORY_ROOT;

const RAW_GITHUB_BASE = "https://raw.githubusercontent.com/tongtrankien1605";
const RAW_REPOSITORY_ROOT = "/daohuyenmy-clone/main/";
const RAW_BASE_URL = RAW_GITHUB_BASE + RAW_REPOSITORY_ROOT;

const STATIC_ASSETS = [
    `${BASE_URL}favicon.ico`,
    `${BASE_URL}index.html`,
    `${BASE_URL}offline.html`,
    `${BASE_URL}placeholder.jpg`,
    `${BASE_URL}videos.json`,
    `${BASE_URL}sw.js`
];

let totalBandwidth = 0;

function formatBandwidth(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sendBandwidthUpdate(size) {
    totalBandwidth += size;
    self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage({
                type: "BANDWIDTH_UPDATE",
                totalBandwidth: totalBandwidth
            });
        });
    });
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    if (/\.(mp4|webm|ogg)$/i.test(requestUrl.pathname)) {
        event.respondWith(
            fetch(event.request, { mode: "cors", credentials: "omit" })
                .then(async (networkResponse) => {
                    const contentLength = networkResponse.headers.get("Content-Length");
                    let size = contentLength ? parseInt(contentLength, 10) : 0;
                    if (!size) {
                        const blob = await networkResponse.clone().blob();
                        size = blob.size;
                    }
                    sendBandwidthUpdate(size);
                    console.log(
                        `Tải từ server: ${requestUrl.href} | Kích thước: ${formatBandwidth(size)} | Tổng băng thông: ${formatBandwidth(totalBandwidth)}`
                    );
                    return networkResponse;
                })
                .catch(() => {
                    console.error("Fetch failed:", requestUrl.href);
                    return caches.match(`${BASE_URL}offline.html`);
                })
        );
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    console.log(`Từ cache: ${requestUrl.href}`);
                    return cachedResponse;
                }

                return fetch(event.request, { mode: "cors", credentials: "omit" })
                    .then(async (networkResponse) => {
                        if (networkResponse.ok && requestUrl.href.startsWith(BASE_URL)) {
                            const contentLength = networkResponse.headers.get("Content-Length");
                            let size = contentLength ? parseInt(contentLength, 10) : 0;
                            if (!size) {
                                const blob = await networkResponse.clone().blob();
                                size = blob.size;
                            }
                            sendBandwidthUpdate(size);
                            console.log(
                                `Tải từ server: ${requestUrl.href} | Kích thước: ${formatBandwidth(size)} | Tổng băng thông: ${formatBandwidth(totalBandwidth)}`
                            );
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        console.error("Fetch failed:", requestUrl.href);
                        return caches.match(`${BASE_URL}offline.html`);
                    });
            });
        })
    );
});