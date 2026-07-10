let map;
let panorama;

let directionsService;
let directionsRenderer;




window.onload=function(){

document
.getElementById("g_id_onload")
.dataset.client_id=
CONFIG.GOOGLE_CLIENT_ID;


};





function switchPage(page){


if(page==="map"){


document
.getElementById("page-menu")
.classList.add("hidden");


document
.getElementById("page-map-dashboard")
.classList.remove("hidden");


google.maps.event.trigger(map,"resize");


}

else{


document
.getElementById("page-map-dashboard")
.classList.add("hidden");


document
.getElementById("page-menu")
.classList.remove("hidden");


}



}





function handleCredentialResponse(response){


console.log(response.credential);


alert(
"Google登入成功"
);


}







function initMap(){



let pos={

lat:25.0478,

lng:121.517

};



map=new google.maps.Map(

document.getElementById("map"),

{

center:pos,

zoom:14

}

);




panorama=new google.maps.StreetViewPanorama(

document.getElementById("pano"),

{

position:pos,

pov:{heading:0,pitch:0}

}

);



directionsService=
new google.maps.DirectionsService();



directionsRenderer=
new google.maps.DirectionsRenderer();


directionsRenderer.setMap(map);



}








function updateProgress(v){


document
.getElementById("progress-bar")
.style.width=v+"%";


document
.getElementById("progress-number")
.innerHTML=v+"%";


}









async function generateStreetViewVideo(){



let start=
document.getElementById("start-input").value;


let end=
document.getElementById("end-input").value;


let status=
document.getElementById("status-text");



let btn=
document.getElementById("btn-generate");



btn.disabled=true;



updateProgress(0);



status.innerHTML=
"搜尋路線...";





directionsService.route(

{

origin:start,

destination:end,

travelMode:"DRIVING"

},


async function(result,statusCode){



if(statusCode!="OK"){


alert("找不到路線");

btn.disabled=false;

return;

}




directionsRenderer
.setDirections(result);



let points=[];



result.routes[0]
.legs[0]
.steps
.forEach(s=>{


s.path.forEach(p=>{

points.push(p);

});


});




// 限制圖片數量

let sample=[];


let count=12;


let gap=Math.floor(
points.length/count
);



for(
let i=0;
i<points.length;
i+=gap
){

sample.push(points[i]);


}





let images=[];



for(
let i=0;
i<sample.length;
i++
){



let p=sample[i];


let next=
sample[i+1]||p;



let heading=
google.maps.geometry.spherical.computeHeading(
p,
next
);



let url=

`https://maps.googleapis.com/maps/api/streetview?
size=600x400&
location=${p.lat()},${p.lng()}&
heading=${heading}&
pitch=10&
key=${CONFIG.GOOGLE_MAPS_API_KEY}`;



images.push(url);



updateProgress(
Math.floor(
(i+1)/sample.length*70
)

);



status.innerHTML=
`取得街景 ${i+1}/${sample.length}`;



}





status.innerHTML=
"製作GIF...";


updateProgress(75);






gifshot.createGIF(

{


images:images,

interval:0.5,

gifWidth:600,

gifHeight:400


},


function(obj){



if(!obj.error){


document
.getElementById("preview-gif")
.src=obj.image;



document
.getElementById("download-link")
.href=obj.image;



document
.getElementById("preview-container")
.classList.remove("hidden");



updateProgress(100);


status.innerHTML=
"完成";



}

else{


status.innerHTML=
"GIF失敗";


}



btn.disabled=false;



}

);



}



);



}