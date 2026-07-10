let map;

let panorama;

let directionsService;

let directionsRenderer;




// =======================
// Google Login
// =======================


function handleCredentialResponse(response){

    console.log(
        "Google Token:",
        response.credential
    );


    alert(
        "Google 登入成功"
    );

}




// =======================
// Page Switch
// =======================


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



        google.maps.event.trigger(
            map,
            "resize"
        );


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







// =======================
// Init Map
// =======================


function initMap(){



    let start={

        lat:25.0478,

        lng:121.517

    };



    map=new google.maps.Map(

        document.getElementById(
            "map"
        ),

        {

            center:start,

            zoom:15

        }

    );





    panorama =
    new google.maps.StreetViewPanorama(

        document.getElementById(
            "pano"
        ),

        {

            position:start,

            pov:
            {

                heading:0,

                pitch:0

            }

        }

    );



    map.setStreetView(
        panorama
    );





    directionsService =
    new google.maps.DirectionsService();




    directionsRenderer =
    new google.maps.DirectionsRenderer();


    directionsRenderer.setMap(
        map
    );


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









// =======================
// Generate WebM
// =======================


async function generateVideo(){



let start =
document.getElementById(
"start-input"
).value;



let end =
document.getElementById(
"end-input"
).value;



let status =
document.getElementById(
"status-text"
);



let btn =
document.getElementById(
"btn-generate"
);



btn.disabled=true;




status.innerHTML=
"搜尋路線...";



updateProgress(0);






directionsService.route(

{

origin:start,

destination:end,

travelMode:
google.maps.TravelMode.DRIVING


},


async(result,state)=>{



if(state!=="OK"){


alert(
"找不到路線"
);


btn.disabled=false;


return;


}






directionsRenderer
.setDirections(
result
);






let points=[];



result
.routes[0]
.legs[0]
.steps
.forEach(step=>{


step.path.forEach(p=>{


points.push(p);


});


});







// frame數量

let FRAME_COUNT=50;



let frames=[];



let gap =
Math.floor(
points.length / FRAME_COUNT
);






for(
let i=0;
i<points.length;
i+=gap
){


frames.push(
points[i]
);


}







status.innerHTML=
"取得街景圖片...";





let images=[];





for(
let i=0;
i<frames.length;
i++
){



let p=frames[i];



let next=
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




updateProgress(
Math.floor(
(i/frames.length)*60
)

);



}








status.innerHTML=
"製作影片...";




let video =
await createWebM(
images
);






document
.getElementById(
"preview-video"
)
.src =
video;



document
.getElementById(
"download-link"
)
.href =
video;




document
.getElementById(
"video-container"
)
.classList
.remove("hidden");




updateProgress(100);



status.innerHTML=
"完成";



btn.disabled=false;




});

}











// =======================
// Canvas -> WebM
// =======================


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



recorder.ondataavailable=e=>{


if(e.data.size>0)

chunks.push(e.data);


};



recorder.start();






for(let img of images){



await new Promise(resolve=>{


let image =
new Image();


image.crossOrigin="anonymous";



image.onload=()=>{


ctx.drawImage(
image,
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



image.src=img;



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
