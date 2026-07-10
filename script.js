let map;
let panorama;

let directionsService;
let directionsRenderer;
let geocoder;


let startMarker=null;
let endMarker=null;


let startPosition=null;
let endPosition=null;



// =================================
// Google Login
// =================================

function handleCredentialResponse(response){

    console.log(
        "Google Login Token:",
        response.credential
    );


    alert(
        "Google 登入成功"
    );

}






// =================================
// Page Switch
// =================================


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








// =================================
// Init Map
// =================================


function initMap(){



    let defaultPos={

        lat:25.0478,

        lng:121.517

    };




    map=new google.maps.Map(

        document.getElementById("map"),

        {

            center:defaultPos,

            zoom:15

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









// =================================
// 定位起點
// =================================


function locateStart(){



    let address =
    document
    .getElementById(
        "start-input"
    )
    .value;



    if(!address){

        alert(
            "請輸入起點"
        );

        return;

    }



    geocodeAddress(
        address,
        "start"
    );


}









// =================================
// 定位終點
// =================================


function locateEnd(){


    let address =
    document
    .getElementById(
        "end-input"
    )
    .value;



    if(!address){

        alert(
            "請輸入目的地"
        );

        return;

    }



    geocodeAddress(
        address,
        "end"
    );


}









// =================================
// 地址轉座標
// =================================


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

                    label:"A",

                    animation:
                    google.maps.Animation.DROP

                });



                panorama.setPosition(
                    pos
                );



            }

            else{



                endPosition=pos;



                if(endMarker)
                    endMarker.setMap(null);



                endMarker =
                new google.maps.Marker({

                    map:map,

                    position:pos,

                    label:"B",

                    animation:
                    google.maps.Animation.DROP

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











// =================================
// Progress
// =================================


function updateProgress(v){



document
.getElementById(
"progress-bar"
)
.style.width=v+"%";



document
.getElementById(
"progress-number"
)
.innerText=v+"%";


}









// =================================
// 產生影片
// =================================


async function generateVideo(){



let start =
document
.getElementById(
"start-input"
)
.value;



let end =
document
.getElementById(
"end-input"
)
.value;



let status =
document
.getElementById(
"status-text"
);



let mode =
document
.querySelector(
"input[name='play-mode']:checked"
)
.value;



if(!start || !end){


alert(
"請輸入起點與目的地"
);


return;


}



updateProgress(0);



status.innerHTML=
"建立路線...";







directionsService.route(

{

origin:start,

destination:end,

travelMode:
google.maps.TravelMode.DRIVING


},

async function(result,statusCode){



if(statusCode!=="OK"){


alert(
"路線建立失敗"
);


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


step.path.forEach(p=>{

path.push(p);

});


});






let frameCount=40;



let step=
Math.floor(
path.length/frameCount
);



let frames=[];



for(
let i=0;
i<path.length;
i+=step
){


frames.push(
path[i]
);


}






document
.getElementById(
"api-estimate"
)
.innerHTML=

`

本次預估：

<br>

Street View 請求：

<b>${frames.length}</b>

次

<br>

影片模式：

<b>

${mode==="image"?
"圖片停留模式":
"沿路動畫模式"}

</b>

<br>

剩餘額度：

請至 Google Cloud Console 查看

`;









if(mode==="animation"){



await playStreetAnimation(
frames
);



}






let images=[];



status.innerHTML=
"下載街景圖片...";





for(let i=0;i<frames.length;i++){



let current=frames[i];


let next=
frames[i+1]||current;



let heading =
google.maps.geometry.spherical
.computeHeading(
current,
next
);




let url=

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







let video =
await createWebM(

images,

mode==="image"?2000:300

);






document
.getElementById(
"preview-video"
)
.src=video;



document
.getElementById(
"download-link"
)
.href=video;




document
.getElementById(
"video-container"
)
.classList
.remove("hidden");



updateProgress(100);



status.innerHTML=
"完成";


});


}









// =================================
// StreetView 動畫
// =================================


async function playStreetAnimation(frames){



for(let p of frames){



panorama.setPosition(
p
);



await wait(800);


}


}






function wait(ms){


return new Promise(
resolve=>setTimeout(resolve,ms)
);


}









// =================================
// WebM
// =================================


async function createWebM(images,delay){



let canvas=
document.createElement("canvas");



canvas.width=640;

canvas.height=360;



let ctx=
canvas.getContext("2d");



let stream=
canvas.captureStream(10);



let recorder=
new MediaRecorder(
stream,
{
mimeType:"video/webm"
}
);



let chunks=[];



recorder.ondataavailable=e=>{

if(e.data.size>0)

chunks.push(e.data);

};



recorder.start();






for(let src of images){



await new Promise(resolve=>{


let img=new Image();


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
delay
);



};



img.src=src;



});



}





recorder.stop();





return new Promise(resolve=>{


recorder.onstop=()=>{


let blob=
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