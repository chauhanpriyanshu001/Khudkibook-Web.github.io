var feedemail=document.getElementById("fedbackemail");
var feedbackl=document.getElementById("fedback");
var post=document.getElementById("postfeed");
var footer=document.getElementById("footer")
var error=document.getElementsByClassName("error")[0]

function validateEmail(email) {
    var emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
}
feedemail.addEventListener("input",()=>{
    var email=feedemail.value;

    val=validateEmail(email)
    if(val ==false){
        error.innerText="Enter valid email"
    }
    else{
        error.innerText=""

    }
})
post.addEventListener("click",async()=>{
    const auth = firebase.auth();
    const db = firebase.firestore();
    var email=feedemail.value;
    var feedback=feedbackl.value;
    if(email != "" && feedback != ""){
        await db.collection("feedback").doc().set({
        
            email: feedemail.value,
            feedback:feedbackl.value
        })
        footer.innerHTML=`
        <h6 class="ftreh1">Posted !! Thank You For Your Feedback</h6>
        `
        
    }
    else{
        
    }
    

})


