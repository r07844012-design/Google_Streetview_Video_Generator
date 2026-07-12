let map;
let panorama;
let directionsService;
let directionsRenderer;
let geocoder;
let startMarker = null;
let endMarker = null;
let activeVideoJob = null;
let activeConfig = { ...CONFIG };
let mapsLoading = false;

const CUSTOM_CONFIG_STORAGE_KEY = "streetview-custom-google-config";
const CONFIG_PROFILE_STORAGE_KEY = "streetview-config-profile";

function initializeAccountSettings(){
    const savedConfig = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
    if(savedConfig){
        try{
            const { clientId, mapsApiKey } = JSON.parse(savedConfig);
            document.getElementById("custom-client-id").value = clientId || "";
            document.getElementById("custom-maps-api-key").value = mapsApiKey || "";
        }catch(error){
            localStorage.removeItem(CUSTOM_CONFIG_STORAGE_KEY);
        }
    }

    const savedProfile = localStorage.getItem(CONFIG_PROFILE_STORAGE_KEY) || "creator";
    document.querySelector(`input[name="config-profile"][value="${savedProfile}"]`).checked = true;
    selectConfigProfile(savedProfile);
    if(savedProfile === "custom" && activeConfig.GOOGLE_CLIENT_ID !== CONFIG.GOOGLE_CLIENT_ID){
        renderGoogleSignIn(activeConfig.GOOGLE_CLIENT_ID);
    }
}

function selectConfigProfile(profile){
    const customFields = document.getElementById("custom-config-fields");
    customFields.classList.toggle("hidden", profile !== "custom");
    localStorage.setItem(CONFIG_PROFILE_STORAGE_KEY, profile);

    if(profile === "creator"){
        activeConfig = { ...CONFIG };
        return;
    }

    try{
        const savedConfig = JSON.parse(localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY));
        if(savedConfig?.clientId && savedConfig?.mapsApiKey){
            activeConfig = {
                GOOGLE_CLIENT_ID:savedConfig.clientId,
                GOOGLE_MAPS_API_KEY:savedConfig.mapsApiKey
            };
        }
    }catch(error){
        localStorage.removeItem(CUSTOM_CONFIG_STORAGE_KEY);
    }
}

function saveCustomConfig(){
    const clientId = document.getElementById("custom-client-id").value.trim();
    const mapsApiKey = document.getElementById("custom-maps-api-key").value.trim();
    if(!clientId || !mapsApiKey){
        alert("請填寫 Google Client ID 與 Google Maps API Key");
        return;
    }

    activeConfig = { GOOGLE_CLIENT_ID:clientId, GOOGLE_MAPS_API_KEY:mapsApiKey };
    localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify({ clientId, mapsApiKey }));
    localStorage.setItem(CONFIG_PROFILE_STORAGE_KEY, "custom");
    renderGoogleSignIn(clientId);
    alert("設定已儲存在這台裝置的瀏覽器中。");
}

function renderGoogleSignIn(clientId){
    const container = document.getElementById("google-signin-button");
    container.replaceChildren();
    google.accounts.id.initialize({ client_id:clientId, callback:handleCredentialResponse });
    google.accounts.id.renderButton(container, {
        type:"standard", theme:"outline", size:"large", text:"signin_with", locale:"zh-TW", width:260
    });
}

function loadGoogleMaps(){
    if(map || mapsLoading) return;
    mapsLoading = true;
    const script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(activeConfig.GOOGLE_MAPS_API_KEY) + "&libraries=geometry&callback=initMap&loading=async";
    script.async = true;
    script.onerror = () => {
        mapsLoading = false;
        alert("Google Maps 載入失敗，請確認目前帳戶設定的 Maps API Key。");
    };
    document.head.appendChild(script);
}

function handleCredentialResponse(response){
    console.log("Google Login Token:", response.credential);
    alert("Google 登入成功");
}

function switchPage(page){
    if(page === "map"){
        document.getElementById("page-menu").classList.add("hidden");
        document.getElementById("page-account").classList.add("hidden");
        document.getElementById("page-map-dashboard").classList.remove("hidden");
        if(map){
            setTimeout(() => google.maps.event.trigger(map, "resize"), 300);
        }else{
            loadGoogleMaps();
        }
        return;
    }

    if(page === "account"){
        document.getElementById("page-menu").classList.add("hidden");
        document.getElementById("page-map-dashboard").classList.add("hidden");
        document.getElementById("page-account").classList.remove("hidden");
        return;
    }

    document.getElementById("page-map-dashboard").classList.add("hidden");
    document.getElementById("page-account").classList.add("hidden");
    document.getElementById("page-menu").classList.remove("hidden");
}

function initMap(){
    const defaultPos = { lat:25.0478, lng:121.517 };
    map = new google.maps.Map(document.getElementById("map"), { center:defaultPos, zoom:15 });
    panorama = new google.maps.StreetViewPanorama(document.getElementById("pano"), {
        position:defaultPos,
        pov:{ heading:0, pitch:10 }
    });
    map.setStreetView(panorama);
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map:map, suppressMarkers:true });
    geocoder = new google.maps.Geocoder();
}

function locateStart(){
    geocodeAddress(document.getElementById("start-input").value, "start");
}

function locateEnd(){
    geocodeAddress(document.getElementById("end-input").value, "end");
}

function geocodeAddress(address, type){
    geocoder.geocode({ address:address }, (results, status) => {
        if(status !== "OK"){
            alert("找不到位置");
            return;
        }

        const pos = results[0].geometry.location;
        const markerOptions = {
            map:map,
            position:pos,
            animation:google.maps.Animation.DROP,
            label:type === "start" ? "A" : "B"
        };

        if(type === "start"){
            if(startMarker) startMarker.setMap(null);
            startMarker = new google.maps.Marker(markerOptions);
        }else{
            if(endMarker) endMarker.setMap(null);
            endMarker = new google.maps.Marker(markerOptions);
        }

        map.panTo(pos);
        panorama.setPosition(pos);
    });
}

function updateProgress(value, text = ""){
    document.getElementById("progress-bar").style.width = value + "%";
    document.getElementById("progress-number").innerText = value + "%";
    if(text) document.getElementById("status-text").innerHTML = text;
}

function openApiModal(){
    document.getElementById("api-modal").classList.remove("hidden");
}

function closeApiModal(){
    document.getElementById("api-modal").classList.add("hidden");
}

function formatRemainingTime(seconds){
    const remaining = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateGenerateButton(isGenerating){
    const button = document.getElementById("btn-generate");
    button.innerText = isGenerating ? "✕ 取消產生" : "🎬 產生影片";
}

function startCountdown(job, seconds){
    const estimate = document.getElementById("estimate-time");
    const endAt = Date.now() + seconds * 1000;
    const render = () => {
        const secondsLeft = (endAt - Date.now()) / 1000;
        estimate.innerText = `預估剩餘 ${formatRemainingTime(secondsLeft)}`;
    };

    render();
    job.countdownId = setInterval(render, 250);
}

function finishVideoJob(job, message, keepEstimate = false){
    if(!job || activeVideoJob !== job) return;
    clearInterval(job.countdownId);
    activeVideoJob = null;
    updateGenerateButton(false);
    if(!keepEstimate) document.getElementById("estimate-time").innerText = "--";
    if(message) document.getElementById("status-text").innerText = message;
}

function cancelVideoGeneration(){
    const job = activeVideoJob;
    if(!job) return;

    job.cancelled = true;
    if(job.cancelTimeout) job.cancelTimeout();
    if(job.recorder && job.recorder.state !== "inactive") job.recorder.stop();
    finishVideoJob(job, "已取消產生");
}

function ensureActiveJob(job){
    if(job.cancelled || activeVideoJob !== job) throw new DOMException("影片產生已取消", "AbortError");
}

async function generateVideo(){
    if(activeVideoJob){
        cancelVideoGeneration();
        return;
    }

    const start = document.getElementById("start-input").value;
    const end = document.getElementById("end-input").value;
    const transport = document.querySelector('input[name="transport-mode"]:checked').value;
    const frameDistance = Number(document.getElementById("frame-distance").value);
    if(!start || !end){
        alert("請輸入起點與目的地");
        return;
    }
    if(!Number.isFinite(frameDistance) || frameDistance < 10){
        alert("請輸入至少 10 公尺的取樣距離");
        return;
    }

    const travelModes = {
        car:google.maps.TravelMode.DRIVING,
        motorcycle:google.maps.TravelMode.DRIVING,
        walking:google.maps.TravelMode.WALKING
    };
    const transportLabels = {
        car:"汽車",
        motorcycle:"機車（依駕車路線規劃）",
        walking:"步行"
    };

    const job = { cancelled:false, countdownId:null, recorder:null };
    activeVideoJob = job;
    updateGenerateButton(true);
    updateProgress(0, "建立路線...");

    directionsService.route({
        origin:start,
        destination:end,
        travelMode:travelModes[transport]
    }, async (result, statusCode) => {
        if(job.cancelled || activeVideoJob !== job) return;
        if(statusCode !== "OK"){
            finishVideoJob(job, "路線建立失敗");
            alert("路線建立失敗");
            return;
        }

        try{
            directionsRenderer.setDirections(result);
            const path = [];
            result.routes[0].legs[0].steps.forEach(step => step.path.forEach(point => path.push(point)));
            const frames = samplePathByDistance(path, frameDistance);

            const videoLength = Math.round(frames.length * 1.5);
            const processingEstimate = frames.length * (0.8 + 1.5);
            document.getElementById("api-estimate").innerHTML = `
                本次預估：<br>
                Street View 圖片：<b>${frames.length}</b> 張<br>
                路線小地圖：<b>1</b> 張 Maps Static API<br>
                交通工具：<b>${transportLabels[transport]}</b><br>
                取樣距離：<b>每 ${frameDistance} 公尺一張</b><br>
                每張：<b>1.5秒</b><br>
                影片長度：<b>${videoLength} 秒</b><br><br>
                額度請至 <a href="https://console.cloud.google.com/apis/dashboard?authuser=1&organizationId=1007703161268&project=project-e6beb6c1-7d26-433c-89f" target="_blank" rel="noopener noreferrer">Google Cloud Console</a> 查看
            `;
            startCountdown(job, processingEstimate);

            document.getElementById("status-text").innerText = "準備路線小地圖...";
            const miniMap = await createRouteMiniMap(frames);
            ensureActiveJob(job);

            await playStreetAnimation(frames, job);
            ensureActiveJob(job);

            const images = [];
            document.getElementById("status-text").innerText = "取得街景圖片...";
            for(let i = 0; i < frames.length; i++){
                ensureActiveJob(job);
                const current = frames[i];
                const next = frames[i + 1] || current;
                const heading = google.maps.geometry.spherical.computeHeading(current, next);
                images.push(
                    "https://maps.googleapis.com/maps/api/streetview?size=640x360" +
                    `&location=${current.lat()},${current.lng()}` +
                    `&heading=${heading}&pitch=10&key=${activeConfig.GOOGLE_MAPS_API_KEY}`
                );
                updateProgress(Math.floor((i / frames.length) * 60), `下載街景 ${i + 1}/${frames.length}`);
            }

            const video = await createWebM(images, frames, 1500, job, miniMap);
            ensureActiveJob(job);
            document.getElementById("preview-video").src = video;
            document.getElementById("download-link").href = video;
            document.getElementById("video-container").classList.remove("hidden");
            updateProgress(100, "🎉 影片完成");
            finishVideoJob(job, "🎉 影片完成", true);
            document.getElementById("estimate-time").innerText = "已完成";
        }catch(error){
            if(error.name !== "AbortError"){
                console.error("影片產生失敗", error);
                finishVideoJob(job, "影片產生失敗");
            }
        }
    });
}

function samplePathByDistance(path, intervalMeters){
    if(path.length < 2) return path;

    const frames = [path[0]];
    let distanceSinceLastFrame = 0;

    for(let i = 1; i < path.length; i++){
        let segmentStart = path[i - 1];
        const segmentEnd = path[i];
        let segmentDistance = google.maps.geometry.spherical.computeDistanceBetween(segmentStart, segmentEnd);

        while(distanceSinceLastFrame + segmentDistance >= intervalMeters){
            const distanceToNextFrame = intervalMeters - distanceSinceLastFrame;
            const heading = google.maps.geometry.spherical.computeHeading(segmentStart, segmentEnd);
            const frame = google.maps.geometry.spherical.computeOffset(segmentStart, distanceToNextFrame, heading);
            frames.push(frame);
            segmentStart = frame;
            segmentDistance -= distanceToNextFrame;
            distanceSinceLastFrame = 0;
        }

        distanceSinceLastFrame += segmentDistance;
    }

    const lastPoint = path[path.length - 1];
    if(google.maps.geometry.spherical.computeDistanceBetween(frames[frames.length - 1], lastPoint) > 1){
        frames.push(lastPoint);
    }
    return frames;
}

async function createRouteMiniMap(frames){
    const width = 220;
    const height = 130;
    const outline = simplifyPath(frames, 90);
    const viewport = getMiniMapViewport(outline, width, height);
    const encodedPath = google.maps.geometry.encoding.encodePath(outline);
    const params = new URLSearchParams({
        center:`${viewport.center.lat},${viewport.center.lng}`,
        zoom:String(viewport.zoom),
        size:`${width}x${height}`,
        maptype:"roadmap",
        path:`color:0x4285F4ff|weight:4|enc:${encodedPath}`,
        key:activeConfig.GOOGLE_MAPS_API_KEY
    });

    try{
        return {
            image:await loadCanvasImage(`https://maps.googleapis.com/maps/api/staticmap?${params}`),
            width,
            height,
            viewport
        };
    }catch(error){
        console.warn("路線小地圖載入失敗", error);
        return null;
    }
}

function simplifyPath(path, maxPoints){
    if(path.length <= maxPoints) return path;
    const step = Math.ceil(path.length / maxPoints);
    const simplified = path.filter((point, index) => index % step === 0);
    const lastPoint = path[path.length - 1];
    if(simplified[simplified.length - 1] !== lastPoint) simplified.push(lastPoint);
    return simplified;
}

function getMiniMapViewport(path, width, height){
    const worldPoints = path.map(point => latLngToWorld(point, 0));
    const minX = Math.min(...worldPoints.map(point => point.x));
    const maxX = Math.max(...worldPoints.map(point => point.x));
    const minY = Math.min(...worldPoints.map(point => point.y));
    const maxY = Math.max(...worldPoints.map(point => point.y));
    const spanX = Math.max(maxX - minX, 0.0001);
    const spanY = Math.max(maxY - minY, 0.0001);
    const zoom = Math.max(1, Math.min(18, Math.floor(Math.log2(Math.min((width - 32) / spanX, (height - 32) / spanY)))));
    const centerWorld = { x:(minX + maxX) / 2, y:(minY + maxY) / 2 };

    return { zoom, center:worldToLatLng(centerWorld, 0) };
}

function latLngToWorld(point, zoom){
    const scale = 256 * 2 ** zoom;
    const latitude = typeof point.lat === "function" ? point.lat() : point.lat;
    const longitude = typeof point.lng === "function" ? point.lng() : point.lng;
    const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const sin = Math.sin(lat * Math.PI / 180);
    return {
        x:(longitude + 180) / 360 * scale,
        y:(0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    };
}

function worldToLatLng(point, zoom){
    const scale = 256 * 2 ** zoom;
    const lng = point.x / scale * 360 - 180;
    const lat = 180 / Math.PI * Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y / scale)));
    return { lat, lng };
}

function loadCanvasImage(src){
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("圖片載入失敗"));
        image.src = src;
    });
}

function drawRouteMiniMap(ctx, miniMap, position){
    if(!miniMap) return;

    const x = 12;
    const y = 360 - miniMap.height - 12;
    const centerWorld = latLngToWorld(miniMap.viewport.center, miniMap.viewport.zoom);
    const pointWorld = latLngToWorld(position, miniMap.viewport.zoom);
    const markerX = x + miniMap.width / 2 + pointWorld.x - centerWorld.x;
    const markerY = y + miniMap.height / 2 + pointWorld.y - centerWorld.y;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, .28)";
    ctx.fillRect(x - 3, y - 3, miniMap.width + 6, miniMap.height + 6);
    ctx.drawImage(miniMap.image, x, y, miniMap.width, miniMap.height);
    ctx.beginPath();
    ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ea4335";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.restore();
}

async function playStreetAnimation(frames, job){
    for(const point of frames){
        ensureActiveJob(job);
        panorama.setPosition(point);
        await wait(800, job);
    }
}

function wait(ms, job){
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            job.cancelled ? reject(new DOMException("影片產生已取消", "AbortError")) : resolve();
        }, ms);
        job.cancelTimeout = () => {
            clearTimeout(timeout);
            reject(new DOMException("影片產生已取消", "AbortError"));
        };
    });
}

async function createWebM(images, frames, delay, job, miniMap){
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType:"video/webm" });
    const chunks = [];
    job.recorder = recorder;
    recorder.ondataavailable = event => {
        if(event.data.size > 0) chunks.push(event.data);
    };
    recorder.start();

    for(let i = 0; i < images.length; i++){
        ensureActiveJob(job);
        await new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => {
                try{
                    if(job.cancelled) return reject(new DOMException("影片產生已取消", "AbortError"));
                    ctx.clearRect(0, 0, 640, 360);
                    ctx.drawImage(image, 0, 0, 640, 360);
                    drawRouteMiniMap(ctx, miniMap, frames[i]);
                    updateProgress(60 + Math.floor(((i + 1) / images.length) * 40), `製作影片 ${i + 1}/${images.length}`);
                    setTimeout(() => job.cancelled ? reject(new DOMException("影片產生已取消", "AbortError")) : resolve(), delay);
                }catch(error){
                    reject(error);
                }
            };
            image.onerror = () => resolve();
            image.src = images[i];
        });
    }

    ensureActiveJob(job);
    const video = await new Promise(resolve => {
        recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type:"video/webm" })));
        recorder.stop();
    });
    job.recorder = null;
    return video;
}
