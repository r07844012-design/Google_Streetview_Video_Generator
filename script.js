let map, panorama, directionsService, directionsRenderer, streetViewService;
let routeCoordinates = []; // 儲存路徑上的所有經緯度點

// 調整：在頁面載入時，將 config.js 的 Client ID 動態塞入 Google 登入元件中
window.addEventListener('DOMContentLoaded', () => {
    const googleLoginContainer = document.getElementById('g_id_onload');
    if (googleLoginContainer) {
        googleLoginContainer.setAttribute('data-client_id', CONFIG.GOOGLE_CLIENT_ID);
    }
});

// 1. 頁面切換邏輯
function switchPage(page) {
    if (page === 'map') {
        document.getElementById('page-menu').classList.add('hidden');
        document.getElementById('page-map-dashboard').classList.remove('hidden');
        if (map) google.maps.event.trigger(map, 'resize');
    } else {
        document.getElementById('page-map-dashboard').classList.add('hidden');
        document.getElementById('page-menu').classList.remove('hidden');
    }
}

// 2. Google 登入回傳處理
function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);
    alert("Google 帳號連接成功！(Token已取得，可供後續API串接使用)");
}

// 3. 初始化 Google Map
function initMap() {
    const defaultPos = { lat: 25.0478, lng: 121.5170 };
    
    map = new google.maps.Map(document.getElementById("map"), {
        center: defaultPos,
        zoom: 14,
    });

    panorama = new google.maps.StreetViewPanorama(
        document.getElementById("pano"), {
            position: defaultPos,
            pov: { heading: 34, pitch: 10 }
        }
    );
    map.setStreetView(panorama);

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
    streetViewService = new google.maps.StreetViewService();
}

// 4. 核心功能：規劃路徑並自動擷取街景生成影片
async function generateStreetViewVideo() {
    const start = document.getElementById('start-input').value;
    const end = document.getElementById('end-input').value;
    const statusText = document.getElementById('status-text');
    const btnGenerate = document.getElementById('btn-generate');
    const previewContainer = document.getElementById('preview-container');
    
    if(!start || !end) {
        alert('請輸入起始點與結束點');
        return;
    }

    btnGenerate.disabled = true;
    previewContainer.classList.add('hidden');
    statusText.innerText = "正在規劃導航路線...";

    // 步驟 A: 透過 Directions API 取得導航路線軌跡
    directionsService.route({
        origin: start,
        destination: end,
        travelMode: google.maps.TravelMode.DRIVING
    }, async (response, status) => {
        if (status === "OK") {
            directionsRenderer.setDirections(response);
            
            const legs = response.routes[0].legs[0];
            routeCoordinates = [];
            legs.steps.forEach(step => {
                step.path.forEach(latlng => {
                    routeCoordinates.push(latlng);
                });
            });

            const maxFrames = 20;
            const sampledCoordinates = [];
            const stepSize = Math.max(1, Math.floor(routeCoordinates.length / maxFrames));
            for(let i=0; i<routeCoordinates.length; i+=stepSize) {
                sampledCoordinates.push(routeCoordinates[i]);
            }

            statusText.innerText = `尋找街景中...預計擷取 ${sampledCoordinates.length} 個畫面`;
            
            // 步驟 B: 計算每段路徑的 Heading，並準備 Static Street View 網址
            let imageUrls = [];
            
            for(let i = 0; i < sampledCoordinates.length; i++) {
                let currentPt = sampledCoordinates[i];
                let nextPt = sampledCoordinates[i+1] || sampledCoordinates[i];
                
                let heading = google.maps.geometry.spherical.computeHeading(currentPt, nextPt);
                
                let lat = currentPt.lat();
                let lng = currentPt.lng();
                
                // 調整：此處原先寫死的 Key，改為讀取 CONFIG.GOOGLE_MAPS_API_KEY
                let staticPanoUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${heading}&pitch=10&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
                imageUrls.push(staticPanoUrl);
            }

            // 步驟 C: 利用 gifshot 將圖片網址陣列轉成 GIF 
            statusText.innerText = "正在自動生成縮時影片 (GIF)...";
            
            gifshot.createGIF({
                images: imageUrls,
                interval: 0.3,
                gifWidth: 400,
                gifHeight: 300
            }, function (obj) {
                if (!obj.error) {
                    const animatedImage = obj.image;
                    
                    document.getElementById('preview-gif').src = animatedImage;
                    document.getElementById('download-link').href = animatedImage;
                    
                    previewContainer.classList.remove('hidden');
                    statusText.innerText = "生成成功！";
                } else {
                    statusText.innerText = "GIF 生成失敗";
                }
                btnGenerate.disabled = false;
            });

        } else {
            statusText.innerText = "找不到導航路線，請重新輸入。";
            btnGenerate.disabled = false;
        }
    });
}