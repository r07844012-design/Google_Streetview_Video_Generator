let map;
let panorama;

let directionsService;
let directionsRenderer;

let startMarker = null;
let endMarker = null;

let startPosition = null;
let endPosition = null;

let autocompleteStart;
let autocompleteEnd;



// ================================
// Google Login
// ================================


function handleCredentialResponse(response){

    console.log(
        "Google Token:",
        response.credential
    );


    alert(
        "Google 登入成功"
    );

}




// ================================
// 頁面切換
// ================================


function switchPage(page){


    if(page==="map"){


        document
        .getElementById(
            "page-menu"
        )
        .classList
        .add("hidden");



        document
        .getElementById(
            "page-map-dashboard"
        )
        .classList
        .remove("hidden");



        setTimeout(()=>{

            google.maps.event.trigger(
                map,
                "resize"
            );

        },300);



    }
    else{


        document
        .getElementById(
            "page-map-dashboard"
        )
        .classList
        .add("hidden");



        document
        .getElementById(
            "page-menu"
        )
        .classList
        .remove("hidden");


    }


}







// ================================
// 初始化 Google Map
// ================================


function initMap(){



    let defaultPosition={

        lat:25.0478,

        lng:121.517

    };





    map =
    new google.maps.Map(

        document.getElementById(
            "map"
        ),

        {

            center:
            defaultPosition,

            zoom:15

        }

    );





    panorama =
    new google.maps.StreetViewPanorama(

        document.getElementById(
            "pano"
        ),

        {

            position:
            defaultPosition,

            pov:
            {

                heading:0,

                pitch:10

            }

        }

    );





    map.setStreetView(
        panorama
    );





    directionsService =
    new google.maps.DirectionsService();




    directionsRenderer =
    new google.maps.DirectionsRenderer({

        map:map,

        suppressMarkers:true

    });






    initAutocomplete();

}








// ================================
// 地址搜尋
// ================================


function initAutocomplete(){



    autocompleteStart =
    new google.maps.places.Autocomplete(

        document.getElementById(
            "start-input"
        )

    );




    autocompleteEnd =
    new google.maps.places.Autocomplete(

        document.getElementById(
            "end-input"
        )

    );





    autocompleteStart
    .addListener(
        "place_changed",
        ()=>{


            let place =
            autocompleteStart
            .getPlace();



            if(!place.geometry)
                return;




            startPosition =
            place.geometry.location;



            updateStartMarker();



            moveStreetView(
                startPosition
            );


        }

    );







    autocompleteEnd
    .addListener(
        "place_changed",
        ()=>{


            let place =
            autocompleteEnd
            .getPlace();



            if(!place.geometry)
                return;




            endPosition =
            place.geometry.location;



            updateEndMarker();



        }

    );



}








// ================================
// Marker
// ================================


function updateStartMarker(){



    if(startMarker)
        startMarker.setMap(null);



    startMarker =
    new google.maps.Marker({

        map:map,

        position:startPosition,

        label:"A",

        animation:
        google.maps.Animation.DROP

    });



    map.panTo(
        startPosition
    );

}





function updateEndMarker(){



    if(endMarker)
        endMarker.setMap(null);



    endMarker =
    new google.maps.Marker({

        map:map,

        position:endPosition,

        label:"B",

        animation:
        google.maps.Animation.DROP

    });



    map.panTo(
        endPosition
    );

}





// ================================
// Street View 移動
// ================================


function moveStreetView(position){


    panorama.setPosition(
        position
    );


    panorama.setPov({

        heading:0,

        pitch:10

    });


}









function updateProgress(value){



    document
    .getElementById(
        "progress-bar"
    )
    .style.width =
    value+"%";



    document
    .getElementById(
        "progress-number"
    )
    .innerText =
    value+"%";


}









// ================================
// 產生影片
// ================================


async function generateVideo(){



let status =
document.getElementById(
    "status-text"
);



let button =
document.getElementById(
    "btn-generate"
);



let apiBox =
document.getElementById(
    "api-estimate"
);



button.disabled=true;



updateProgress(0);



status.innerHTML =
"正在規劃路線...";





let start =
document.getElementById(
"start-input"
).value;



let end =
document.getElementById(
"end-input"
).value;





directionsService.route(

{

origin:start,

destination:end,

travelMode:
google.maps.TravelMode.DRIVING


},


async(result,statusCode)=>{



if(statusCode!=="OK"){


alert(
"找不到路線"
);


button.disabled=false;


return;


}






directionsRenderer
.setDirections(
result
);






let path=[];




result
.routes[0]
.legs[0]
.steps
.forEach(step=>{


step.path.forEach(point=>{


path.push(point);


});


});






// 控制 API 消耗

const FRAME_COUNT=40;



let gap =
Math.max(
1,
Math.floor(
path.length /
FRAME_COUNT
)

);



let frames=[];



for(
let i=0;
i<path.length;
i+=gap
){


frames.push(
path[i]
);


}






apiBox.innerHTML=`

本次影片設定：

<br>

Street View 圖片：

<b>
${frames.length}
</b>
張

<br>

預估 API 呼叫：

<b>
${frames.length}
</b>
次

<br>

實際剩餘額度：
<br>

請至 Google Cloud Console 查看

`;







// StreetView跳到開始點

moveStreetView(
frames[0]
);







let images=[];



status.innerHTML =
"取得街景圖片...";





for(
let i=0;
i<frames.length;
i++
){



let current =
frames[i];



let next =
frames[i+1] || current;





let heading =
google.maps.geometry.spherical
.computeHeading(
current,
next
);






let url =

"https://maps.googleapis.com/maps/api/streetview?"

+

"size=640x360"

+

"&location="

+

current.lat()

+

","

+

current.lng()

+

"&heading="

+

heading

+

"&pitch=10"

+

"&key="

+

CONFIG.GOOGLE_MAPS_API_KEY;





images.push(url);





updateProgress(

Math.floor(

(i/frames.length)*60

)

);



}







status.innerHTML =
"正在製作影片...";





let videoURL =
await createWebM(
images
);






document
.getElementById(
"preview-video"
)
.src =
videoURL;





document
.getElementById(
"download-link"
)
.href =
videoURL;





document
.getElementById(
"video-container"
)
.classList
.remove("hidden");





updateProgress(100);



status.innerHTML =
"完成";



button.disabled=false;



}

);



}









// ================================
// Canvas 轉 WebM
// ================================


async function createWebM(images){



let canvas =
document.createElement(
"canvas"
);



canvas.width=640;

canvas.height=360;



let ctx =
canvas.getContext(
"2d"
);



let stream =
canvas.captureStream(
10
);





let recorder =
new MediaRecorder(
stream,
{

mimeType:
"video/webm"

}

);




let chunks=[];



recorder.ondataavailable =
e=>{


if(e.data.size>0)

chunks.push(e.data);


};



recorder.start();






for(let src of images){



await new Promise(resolve=>{


let img =
new Image();



img.crossOrigin =
"anonymous";




img.onload=()=>{


ctx.drawImage(

img,

0,

0,

640,

360

);



setTimeout(
resolve,
100
);



};




img.src=src;



});


}





recorder.stop();





return new Promise(resolve=>{


recorder.onstop=()=>{


let blob =
new Blob(

chunks,

{

type:"video/webm"

}

);




resolve(

URL.createObjectURL(
blob
)

);


};


});


}