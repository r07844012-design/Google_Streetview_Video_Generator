let map;
let panorama;

let directionsService;
let directionsRenderer;
let geocoder;

let startMarker = null;
let endMarker = null;

let lastApiEstimate = "";




// =========================
// Google Login
// =========================

function handleCredentialResponse(response){

    console.log(
        "Google Login:",
        response.credential
    );

    alert("Google 登入成功");

}






// =========================
// Page Switch
// =========================

function switchPage(page){


    if(page==="map"){


        document
        .getElementById("page-menu")
        .classList
        .add("hidden");



        document
        .getElementById("page-map-dashboard")
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
        .getElementById("page-map-dashboard")
        .classList
        .add("hidden");


        document
        .getElementById("page-menu")
        .classList
        .remove("hidden");


    }


}









// =========================
// Init Map
// =========================

function initMap(){



    let defaultPos={

        lat:25.0478,

        lng:121.517

    };





    map =
    new google.maps.Map(

        document.getElementById("map"),

        {

            center:defaultPos,

            zoom:16

        }

    );





    // 獨立 Street View

    panorama =
    new google.maps.StreetViewPanorama(

        document.getElementById("pano"),

        {

            position:defaultPos,

            pov:{

                heading:0,

                pitch:10

            }

        }

    );






    directionsService =
    new google.maps.DirectionsService();





    directionsRenderer =
    new google.maps.DirectionsRenderer({

        map:map,

        suppressMarkers:true

    });





    geocoder =
    new google.maps.Geocoder();



}









// =========================
// 定位
// =========================


function locateStart(){


    let value =
    document
    .getElementById("start-input")
    .value;


    geocodeAddress(
        value,
        "start"
    );


}





function locateEnd(){


    let value =
    document
    .getElementById("end-input")
    .value;


    geocodeAddress(
        value,
        "end"
    );


}








function geocodeAddress(address,type){



    geocoder.geocode(

    {

        address:address

    },


    function(results,status){



        if(status==="OK"){



            let pos =
            results[0]
            .geometry
            .location;





            if(type==="start"){



                if(startMarker)

                    startMarker.setMap(null);




                startMarker =
                new google.maps.Marker({

                    map:map,

                    position:pos,

                    label:"A"

                });



            }



            else{



                if(endMarker)

                    endMarker.setMap(null);




                endMarker =
                new google.maps.Marker({

                    map:map,

                    position:pos,

                    label:"B"

                });


            }




            map.panTo(pos);

            panorama.setPosition(pos);



        }

        else{


            alert(
                "找不到位置"
            );


        }



    });


}











// =========================
// Modal
// =========================


function openApiModal(){


    document
    .getElementById("api-modal")
    .classList
    .remove("hidden");


}





function closeApiModal(){


    document
    .getElementById("api-modal")
    .classList
    .add("hidden");


}









// =========================
// Progress
// =========================


function updateProgress(value,text){


    document
    .getElementById("progress-bar")
    .style.width =
    value+"%";



    document
    .getElementById("progress-number")
    .innerText =
    value+"%";



    document
    .getElementById("status-text")
    .innerText =
    text;



}









// =========================
// Generate Video
// =========================

async function generateVideo(){



let start =
document
.getElementById("start-input")
.value;



let end =
document
.getElementById("end-input")
.value;



if(!start || !end){

alert(
"請輸入起點與目的地"
);

return;

}





updateProgress(
5,
"建立路線中..."
);






directionsService.route(

{


origin:start,


destination:end,


travelMode:

google.maps.TravelMode.DRIVING



},


async function(result,status){



if(status!=="OK"){


alert(
"找不到路線"
);

return;

}




directionsRenderer
.setDirections(result);







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








updateProgress(

20,

"分析路線距離..."

);








// 約8公尺一張

let frames =
createFrames(
path,
8
);







let frameCount =
frames.length;



let totalSeconds =
frameCount*1.5;




let minutes =
Math.floor(
totalSeconds/60
);



let seconds =
Math.round(
totalSeconds%60
);






lastApiEstimate =

`

Street View圖片：

<b>${frameCount}</b> 張

<br>

每張：

<b>1.5 秒</b>

<br>

影片時間：

<b>${minutes} 分 ${seconds} 秒</b>

`;





document
.getElementById("api-estimate")
.innerHTML =
lastApiEstimate;





document
.getElementById("estimated-time")
.innerText =

`${minutes}分${seconds}秒`;








let images=[];






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

25+
Math.floor(
(i/frameCount)*40
),

`取得街景 ${i+1}/${frameCount}`

);



}









// 播放右下街景

updateProgress(
70,
"播放沿路街景..."
);



await animateStreetView(
frames
);






updateProgress(
80,
"生成影片..."
);







let videoURL =
await createVideo(images);






document
.getElementById("preview-video")
.src =
videoURL;




document
.getElementById("download-link")
.href =
videoURL;






document
.getElementById("video-container")
.classList
.remove("hidden");







updateProgress(
100,
"🎉 影片完成"
);



}


);


}









// =========================
// Frame切割
// =========================


function createFrames(path,distance){


let result=[];



if(path.length===0)

return result;



result.push(
path[0]
);



let last =
path[0];






for(
let i=1;
i<path.length;
i++
){



let d =
google.maps.geometry.spherical
.computeDistanceBetween(

last,

path[i]

);





if(d>=distance){


result.push(
path[i]
);



last =
path[i];



}


}



return result;


}









// =========================
// Street View Animation
// =========================

async function animateStreetView(frames){



for(let point of frames){


panorama.setPosition(
point
);



await sleep(
300
);


}



}



function sleep(ms){

return new Promise(
resolve=>setTimeout(resolve,ms)
);

}









// =========================
// 產生 WebM
// =========================


async function createVideo(images){



let canvas =
document.createElement("canvas");



canvas.width=640;

canvas.height=360;




let ctx =
canvas.getContext("2d");





let stream =
canvas.captureStream(2);



let recorder =
new MediaRecorder(
stream
);



let chunks=[];




recorder.ondataavailable=function(e){


if(e.data.size)

chunks.push(e.data);


};




recorder.start();








for(let src of images){



await new Promise(resolve=>{



let img =
new Image();



img.crossOrigin="anonymous";



img.onload=function(){



ctx.drawImage(

img,

0,

0,

640,

360

);




setTimeout(

resolve,

1500

);



};




img.src=src;



});


}







recorder.stop();






return new Promise(resolve=>{



recorder.onstop=function(){



let blob =
new Blob(

chunks,

{

type:"video/webm"

}

);



resolve(
URL.createObjectURL(blob)
);



};



});


}