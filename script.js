let map;
let panorama;
let directionsService;
let directionsRenderer;
let geocoder;
let startMarker = null;
let endMarker = null;
let activeVideoJob = null;

function handleCredentialResponse(response){
    console.log("Google Login Token:", response.credential);
    alert("Google 登入成功");
}

function switchPage(page){
    if(page === "map"){
        document.getElementById("page-menu").classList.add("hidden");
        document.getElementById("page-map-dashboard").classList.remove("hidden");
        setTimeout(() => google.maps.event.trigger(map, "resize"), 300);
        return;
    }

    document.getElementById("page-map-dashboard").classList.add("hidden");
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
    if(!start || !end){
        alert("請輸入起點與目的地");
        return;
    }

    const job = { cancelled:false, countdownId:null, recorder:null };
    activeVideoJob = job;
    updateGenerateButton(true);
    updateProgress(0, "建立路線...");

    directionsService.route({
        origin:start,
        destination:end,
        travelMode:google.maps.TravelMode.DRIVING
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
            const frameCount = 40;
            const step = Math.max(1, Math.floor(path.length / frameCount));
            const frames = [];
            for(let i = 0; i < path.length; i += step) frames.push(path[i]);

            const videoLength = Math.round(frames.length * 1.5);
            const processingEstimate = frames.length * (0.8 + 1.5);
            document.getElementById("api-estimate").innerHTML = `
                本次預估：<br>
                Street View 圖片：<b>${frames.length}</b> 張<br>
                每張：<b>1.5秒</b><br>
                影片長度：<b>${videoLength} 秒</b><br><br>
                額度請至 <a href="https://console.cloud.google.com/apis/dashboard?authuser=1&organizationId=1007703161268&project=project-e6beb6c1-7d26-433c-89f" target="_blank" rel="noopener noreferrer">Google Cloud Console</a> 查看
            `;
            startCountdown(job, processingEstimate);

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
                    `&heading=${heading}&pitch=10&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
                );
                updateProgress(Math.floor((i / frames.length) * 60), `下載街景 ${i + 1}/${frames.length}`);
            }

            const video = await createWebM(images, 1500, job);
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

async function createWebM(images, delay, job){
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
                if(job.cancelled) return reject(new DOMException("影片產生已取消", "AbortError"));
                ctx.clearRect(0, 0, 640, 360);
                ctx.drawImage(image, 0, 0, 640, 360);
                updateProgress(60 + Math.floor(((i + 1) / images.length) * 40), `製作影片 ${i + 1}/${images.length}`);
                setTimeout(() => job.cancelled ? reject(new DOMException("影片產生已取消", "AbortError")) : resolve(), delay);
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
