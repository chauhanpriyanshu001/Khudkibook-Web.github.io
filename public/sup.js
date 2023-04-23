// Get user detail

const firebaseConfig = {
    apiKey: "AIzaSyBvc-vfv2EkbdFa-Wh6ieckvrLooMPYY3w",
    authDomain: "khudkibook.firebaseapp.com",
    databaseURL: "https://khudkibook-default-rtdb.firebaseio.com",
    projectId: "khudkibook",
    storageBucket: "khudkibook.appspot.com",
    messagingSenderId: "245535789373",
    appId: "1:245535789373:web:3977252363ca0bc10a3554",
    measurementId: "G-XRLK80TM3J"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const user = auth.currentUser;
const db = firebase.firestore();

auth.onAuthStateChanged((user) => {
    var menu = document.getElementsByClassName("auth")[0];

    if (user) {
        // Get information from database
        db.collection("users").doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const user = doc.data();
                    var name = user.name;
                    var syllabus = user.syllabus;
                    var semester = user.semester;
                    var branch = user.branch;
                    console.log(name, syllabus, semester, branch)


                    // var name = document.getElementById("name");
                    menu.innerHTML += `<button id="signout"  class="cssbuttons-io "><span>SignOut</span></button>`
                    var signuotbtn = document.getElementById("signout");
                    function signoutf() {
                        auth.signOut().then(() => {
                            // Sign-out 
                            window.location.replace("/login.html");

                        }).catch((error) => {
                            console.log("Error")
                        });
                    }
                    signuotbtn.addEventListener("click", signoutf)


                } else {
                    console.log("No such document!");
                }
            })
            .catch(error => {
                console.log("Error getting document:", error);
            });

    } else {
        // User is signed out
        // console.log("You are not looged in");
        menu.innerHTML += `
        <a href="/signup.html">
        <button class="cssbuttons-io ">
        <span>
            Signup
        </span>
    </button>
    </a>
    <a href="/login.html">
    <button class="cssbuttons-io ">
                <span>
                    Login
                </span>
            </button>
    </a>                 `


        // window.location.replace("/signup.html");



    }
})