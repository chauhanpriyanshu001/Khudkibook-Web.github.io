console.log("Jai shree Ram")

var submit=document.getElementById("submit")

submit.addEventListener("click",()=>{
    var branch=document.getElementById("branch").value
var semester=document.getElementById("semester").value
if(branch=="it"){
    if(semester==1){
        window.location.href="/it/sem1/homepage.html"
    }
   else if(semester==2){
    window.location.href="/it/sem2/homepage.html"
   }
   else if(semester==3){
    window.location.href="/it/sem3/homepage.html"
   }
   else if(semester==4){
    window.location.href="/it/sem4/homepage.html"
   }
   else if(semester==5){
    window.location.href="/it/sem5/homepage.html"
   }
   else if(semester==6){
    window.location.href="/it/sem6/homepage.html"
   }
   else if(semester==7){
    window.location.href="/it/sem7/homepage.html"
   }
   else if(semester==8){
    window.location.href="/it/sem8/homepage.html"
   }
   else{
    
   }
   
}})