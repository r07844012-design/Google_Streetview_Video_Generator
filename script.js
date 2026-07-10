let map;
let panorama;

let directionsService;
let directionsRenderer;
let geocoder;

let startMarker = null;
let endMarker = null;

let startPosition = null;
let endPosition = null;





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
// Page Switch
// ================================


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








// ================================
// 初始化地圖
// ================================


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




    geocoder =
    new google.maps.Geocoder();


}









// ================================
// 定位
// ================================


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


                startPosition=pos;


                if(startMarker)
                    startMarker.setMap(null);



                startMarker =
                new google.maps.Marker({

                    map:map,

                    position:pos,

                    label:"A"

                });



                panorama.setPosition(pos);


            }



            else{


                endPosition=pos;



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



        }

        else{


            alert(
                "找不到位置"
            );


        }


    });


}









// ================================
// Progress
// ================================


function setProgress(value,text){


    document
    .getElementById("progress-bar")
    .style.width=value+"%";



    document
    .getElementById("progress-number")
    .innerText=value+"%";



    document
    .getElementById("status-text")
    .innerText=text;


}









// ================================
// 產生影片
// ================================


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
"請輸入起點與終點"
);

return;

}




setProgress(
5,
"建立路線..."
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
"路線建立失敗"
);


return;


}





directionsRenderer
.setDirections(result);






let rawPath=[];




result
.routes[0]
.legs[0]
.steps
.forEach(step=>{


step.path.forEach(p=>{


rawPath.push(p);


});


});







/*
    重新切割距離

    約5~10公尺一張
*/



let frames =
createDistanceFrames(
rawPath,
8
);







document
.getElementById("api-estimate")
.innerHTML=

`

本次預估：

<br>

Street View 圖片：

<b>
${frames.length}
</b>

張

<br>

每張：

<b>
1.5秒
</b>

<br>

預估影片長度：

<b>
${Math.round(frames.length*1.5)}
秒

</b>

`;






// 右下 StreetView跳起點

panorama.setPosition(
frames[0]
);







setProgress(
20,
"取得街景資料..."
);






let images=[];



for(
let i=0;
i<frames.length;
i++
){



let p =
frames[i];



let next =
frames[i+1] || p;




let heading =
google.maps.geometry.spherical
.computeHeading(
p,
next
);




let url =

"https://maps.googleapis.com/maps/api/streetview?"

+

"size=640x360"

+

"&location="

+

p.lat()

+

","

+

p.lng()

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




setProgress(

20+
Math.floor(
(i/frames.length)*40
),

`下載街景 ${i+1}/${frames.length}`

);



}








setProgress(
65,
"錄製沿路動畫..."
);






await playStreetViewAnimation(
frames
);






let video =
await createVideo(
images
);





document
.getElementById("preview-video")
.src =
video;




document
.getElementById("video-container")
.classList
.remove("hidden");





setProgress(
100,
"✅ 影片完成"
);




});



}









// ================================
// 每 X 公尺取樣
// ================================


function createDistanceFrames(path,distance){



let result=[];



if(path.length===0)
return result;



result.push(
path[0]
);



let last =
path[0];





for(let i=1;i<path.length;i++){



let d =
google.maps.geometry.spherical.computeDistanceBetween(

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









// ================================
// Street View動畫
// ================================


async function playStreetViewAnimation(frames){



for(let p of frames){


panorama.setPosition(
p
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









// ================================
// 產生影片
// ================================


async function createVideo(images){



let canvas =
document.createElement("canvas");


canvas.width=640;

canvas.height=360;




let ctx =
canvas.getContext("2d");



let stream =
canvas.captureStream(10);



let recorder =
new MediaRecorder(

stream,

{

mimeType:"video/webm"

}

);



let chunks=[];



recorder.ondataavailable=e=>{


if(e.data.size)

chunks.push(e.data);


};



recorder.start();






for(let src of images){



await new Promise(resolve=>{


let img =
new Image();



img.crossOrigin="anonymous";



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

1500

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
URL.createObjectURL(blob)
);


};


});


}