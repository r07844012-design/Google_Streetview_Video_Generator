let map;
let panorama;

let directionsService;
let directionsRenderer;
let geocoder;

let startMarker = null;
let endMarker = null;


// ============================
// Google Login
// ============================

function handleCredentialResponse(response){

    console.log(
        "Google Login Token:",
        response.credential
    );

    alert("Google 登入成功");

}




// ============================
// Page Switch
// ============================

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







// ============================
// Init Map
// ============================


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








// ============================
// Marker 定位
// ============================


function locateStart(){


    let text =
    document
    .getElementById("start-input")
    .value;



    geocodeLocation(
        text,
        "start"
    );


}





function locateEnd(){


    let text =
    document
    .getElementById("end-input")
    .value;



    geocodeLocation(
        text,
        "end"
    );

}





function geocodeLocation(address,type){



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
                "找不到地址"
            );


        }



    });


}










// ============================
// Progress
// ============================


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









// ============================
// Generate
// ============================


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
"路線失敗"
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


step.path.forEach(p=>{


path.push(p);


});


});







updateProgress(
20,
"切割路徑..."
);






// 約8公尺一張

let frames =
splitFrames(
path,
8
);






let seconds =
frames.length*1.5;



let min =
Math.floor(seconds/60);


let sec =
Math.round(seconds%60);






document
.getElementById("api-estimate")
.innerHTML=

`

Street View圖片：

<b>${frames.length}</b> 張

<br>

每張：

<b>1.5 秒</b>

<br>

影片時間：

<b>${min}分${sec}秒</b>

`;





document
.getElementById("estimated-time")
.innerText=

`${min}分${sec}秒`;








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
(i/frames.length)*45
),

`取得街景 ${i+1}/${frames.length}`

);



}






// 右下動畫

updateProgress(
70,
"播放街景動畫..."
);



await playStreetView(frames);





updateProgress(
80,
"製作影片..."
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









// ============================
// Split Frame
// ============================


function splitFrames(path,distance){



let result=[];



if(path.length===0)
return result;



result.push(path[0]);



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









// ============================
// Street View Animation
// ============================


async function playStreetView(frames){



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









// ============================
// Create Video
// ============================


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


if(e.data.size>0)

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