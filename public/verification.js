console.log("jai Shree Ram")
var btn = document.getElementsByTagName("button")[0]
var msg = document.getElementsByTagName("p")[0]
const auth = firebase.auth();


setInterval(() => {
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            if (user.emailVerified) {
                // console.log("User's email is verified");
                window.location.replace("/login.html");
            } else {
                // console.log("User's email is not verified");
            }
        } else {
            // console.log("User is not signed in");
        }
    });
}, 1000)
