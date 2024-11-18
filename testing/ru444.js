
let width;

navbar = document.getElementById("nav")
navtag = document.getElementById('nav')
footer = document.getElementById("footer")
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
var footerhtml = `

<div class="ftrreviwwrap">
<div class="about">
    <h3 class="fotthead">ABOUT US</h3>
    <p class="aboutdesc">At Khudkibook, we believe that education should be accessible to everyone. That's
        why we've created a
        platform where GTU (Gujarat Technological University) students can access textbooks and learning
        materials for free. Whether you're preparing for exams, brushing up on your course materials, or
        looking for additional references, Khudkibook offers a vast collection of books, all in one place.
    </p>

</div>
<div class="column feedback">
    <h3 class="fotthead">LEAVE YOUR FEEDBACK </h3>
    <div class="form">

        <input type="email" required name="" placeholder="Email *" id="fedbackemail">
        <span class="error"> </span>

        <textarea name="feedbak" required placeholder="Tell Us about Your Experince *" id="fedback"
            cols="10" rows="5"></textarea>
        <button id="postfeed" type="submit">SHARE</button>
    </div>
</div>
<div class="social">

    <!-- <h3 class="fotthead">LEGAL </h3> -->
    <div class="col">

        <a style="color: white;font-size: 20px;" href="">Privacy</a>
        <a style="color: white;font-size: 20px;" href="">Term of Service</a>
        <a style="color: white;font-size: 20px;" href="">Instagram</a>
    </div>

</div>


<!-- <div class="ftrh1"> Thank You </div>
<div class="ftrh1"> <span>@2024 KhudKibook || </span> <a href="https://khudkibook.web.app/">HomePage</a> ||
    <a href="https://khudkibook.web.app/privacypolicy.html">Privacy Policy</a> || <a
        href="https://khudkibook.web.app/termsofservice.html">Terms of Service</a>
</div> -->

</div>
<span
style="display: flex;justify-content: center;align-items: center;color: orange; font-weight: bold;margin: 10px;">@2024
Khudkibook | Thank You</span>
`;



function handleResize() {
    windowWidth = window.innerWidth;

    navtag.classList.remove('rbb');
    navbar.innerHTML = `
     <div class="navwrap ">
            <!-- Logo -->
            <div class="row">


                <a href="https://khudkibook.web.app/" class="row">
                    <span class="bnltl">
                        <img class="lohh" src="https://khudkibook.web.app/img/bg.png" alt="">

                    </span>

                    <span class="textl">
                        Khudkibook
                    </span>
                </a>

            </div>
            <!-- |Explore-->
            <div class="row gap15 explore">
                <li class="active">
                    <a href="https://khudkibook.web.app/">Home</a>
                </li>
                <li>

                    <div class="link" id="link2">
                        <ul class="col">
                            <div class="list">
                                <li>Diploma</li>
                                <div class="listitem">
                                    <div style="z-index: 100;" class="list2">
                                        <li>I.T</li>
                                        <div class="listitem2">
                                            <a href="/it/sem1/homepage.html">Sem-1</a>
                                            <a href="/it/sem2/homepage.html">Sem-2</a>
                                            <a href="/it/sem3/homepage.html">Sem-3</a>
                                            <a href="/it/sem4/homepage.html">Sem-4</a>
                                            <a href="/it/sem5/homepage.html">Sem-5</a>
                                            <a href="/it/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 200;" class="list2">
                                        <li>Civil</li>
                                        <div class="listitem2">
                                            <a href="/civil/sem1/homepage.html">Sem-1</a>
                                            <a href="/civil/sem2/homepage.html">Sem-2</a>
                                            <a href="/civil/sem3/homepage.html">Sem-3</a>
                                            <a href="/civil/sem4/homepage.html">Sem-4</a>
                                            <a href="/civil/sem5/homepage.html">Sem-5</a>
                                            <a href="/civil/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 300;" class="list2">
                                        <li>Electrical</li>
                                        <div class="listitem2">
                                            <a href="/electrical/sem1/homepage.html">Sem-1</a>
                                            <a href="/electrical/sem2/homepage.html">Sem-2</a>
                                            <a href="/electrical/sem3/homepage.html">Sem-3</a>
                                            <a href="/electrical/sem4/homepage.html">Sem-4</a>
                                            <a href="/electrical/sem5/homepage.html">Sem-5</a>
                                            <a href="/electrical/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 400;" class="list2">
                                        <li>Computer</li>
                                        <div class="listitem2">
                                            <a href="/computer/sem1/homepage.html">Sem-1</a>
                                            <a href="/computer/sem2/homepage.html">Sem-2</a>
                                            <a href="/computer/sem3/homepage.html">Sem-3</a>
                                            <a href="/computer/sem4/homepage.html">Sem-4</a>
                                            <a href="/computer/sem5/homepage.html">Sem-5</a>
                                            <a href="/computer/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 500;" class="list2">
                                        <li>Mechanical</li>
                                        <div class="listitem2">
                                            <a href="/mechanical/sem1/homepage.html">Sem-1</a>
                                            <a href="/mechanical/sem2/homepage.html">Sem-2</a>
                                            <a href="/mechanical/sem3/homepage.html">Sem-3</a>
                                            <a href="/mechanical/sem4/homepage.html">Sem-4</a>
                                            <a href="/mechanical/sem5/homepage.html">Sem-5</a>
                                            <a href="/mechanical/sem6/homepage.html">Sem-6</a>
                                        </div>

                                    </div>
                                </div>


                        </ul>
                    </div>
                </li>
                <li>
                    <a href="https://khudkibook.web.app/">Degree</a>
                </li>
            </div>
            <!-- Register Btn -->





            <div class="auth" id="auth">
            </div>
            <div class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2">
                        <path d="M5 5L12 12L19 5">
                            <animate fill="freeze" attributeName="d" dur="0.4s"
                                values="M5 5L12 12L19 5;M5 5L12 5L19 5" />
                        </path>
                        <path d="M12 12H12">
                            <animate fill="freeze" attributeName="d" dur="0.4s" values="M12 12H12;M5 12H19" />
                        </path>
                        <path d="M5 19L12 12L19 19">
                            <animate fill="freeze" attributeName="d" dur="0.4s"
                                values="M5 19L12 12L19 19;M5 19L12 19L19 19" />
                        </path>
                    </g>
                </svg>
            </div>


        </div>

        <div class="navdropdown" style="display: none;">
            <ul class="navdul">
             <li class="active">
                    <a href="https://khudkibook.web.app/">Home</a>
                </li>
              <div class="link" id="link2">
                        <ul class="col">
                            <div class="list">
                                <li>Diploma</li>
                                <div class="listitem">
                                    <div style="z-index: 100;" class="list2">
                                        <li>I.T</li>
                                        <div class="listitem2">
                                            <a href="/it/sem1/homepage.html">Sem-1</a>
                                            <a href="/it/sem2/homepage.html">Sem-2</a>
                                            <a href="/it/sem3/homepage.html">Sem-3</a>
                                            <a href="/it/sem4/homepage.html">Sem-4</a>
                                            <a href="/it/sem5/homepage.html">Sem-5</a>
                                            <a href="/it/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 200;" class="list2">
                                        <li>Civil</li>
                                        <div class="listitem2">
                                            <a href="/civil/sem1/homepage.html">Sem-1</a>
                                            <a href="/civil/sem2/homepage.html">Sem-2</a>
                                            <a href="/civil/sem3/homepage.html">Sem-3</a>
                                            <a href="/civil/sem4/homepage.html">Sem-4</a>
                                            <a href="/civil/sem5/homepage.html">Sem-5</a>
                                            <a href="/civil/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 300;" class="list2">
                                        <li>Electrical</li>
                                        <div class="listitem2">
                                            <a href="/electrical/sem1/homepage.html">Sem-1</a>
                                            <a href="/electrical/sem2/homepage.html">Sem-2</a>
                                            <a href="/electrical/sem3/homepage.html">Sem-3</a>
                                            <a href="/electrical/sem4/homepage.html">Sem-4</a>
                                            <a href="/electrical/sem5/homepage.html">Sem-5</a>
                                            <a href="/electrical/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 400;" class="list2">
                                        <li>Computer</li>
                                        <div class="listitem2">
                                            <a href="/computer/sem1/homepage.html">Sem-1</a>
                                            <a href="/computer/sem2/homepage.html">Sem-2</a>
                                            <a href="/computer/sem3/homepage.html">Sem-3</a>
                                            <a href="/computer/sem4/homepage.html">Sem-4</a>
                                            <a href="/computer/sem5/homepage.html">Sem-5</a>
                                            <a href="/computer/sem6/homepage.html">Sem-6</a>
                                        </div>


                                    </div>
                                    <div style="z-index: 500;" class="list2">
                                        <li>Mechanical</li>
                                        <div class="listitem2">
                                            <a href="/mechanical/sem1/homepage.html">Sem-1</a>
                                            <a href="/mechanical/sem2/homepage.html">Sem-2</a>
                                            <a href="/mechanical/sem3/homepage.html">Sem-3</a>
                                            <a href="/mechanical/sem4/homepage.html">Sem-4</a>
                                            <a href="/mechanical/sem5/homepage.html">Sem-5</a>
                                            <a href="/mechanical/sem6/homepage.html">Sem-6</a>
                                        </div>

                                    </div>
                                </div>


                        </ul>
                    </div>
                </li>
                <li>
                    <a href="https://khudkibook.web.app/">Degree</a>
                </li>
                 <div class="auth col">

                    </div>
            </div>


                   
                </div>
            </ul>
        </div>
        `;

    footer.innerHTML = footerhtml;

    navmenuop = document.querySelector(".menuop")
    navmenucl = document.querySelector(".menucl")
    menuic = document.querySelector(".icon")
    navdropdown = document.querySelector(".navdropdown")
    let val = 0;
    menuic.addEventListener("click", () => {
        if (val == 0) {
            val = 1
            navdropdown.style.display = "block";
            menuic.innerHTML = `
                <svg class="menucl" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24">
                            <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2">
                                <path d="M5 5L12 5L19 5">
                                    <animate fill="freeze" attributeName="d" dur="0.4s"
                                        values="M5 5L12 5L19 5;M5 5L12 12L19 5" />
                                </path>
                                <path d="M5 12H19">
                                    <animate fill="freeze" attributeName="d" dur="0.4s" values="M5 12H19;M12 12H12" />
                                </path>
                                <path d="M5 19L12 19L19 19">
                                    <animate fill="freeze" attributeName="d" dur="0.4s"
                                        values="M5 19L12 19L19 19;M5 19L12 12L19 19" />
                                </path>
                            </g>
                        </svg>
                `

        }
        else if (val == 1) {
            val = 0
            navdropdown.style.display = "none";
            menuic.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"><path d="M5 5L12 12L19 5"><animate fill="freeze" attributeName="d" dur="0.4s" values="M5 5L12 12L19 5;M5 5L12 5L19 5"/></path><path d="M12 12H12"><animate fill="freeze" attributeName="d" dur="0.4s" values="M12 12H12;M5 12H19"/></path><path d="M5 19L12 12L19 19"><animate fill="freeze" attributeName="d" dur="0.4s" values="M5 19L12 12L19 19;M5 19L12 19L19 19"/></path></g></svg>
                `

        }


    })
}

// Get user detail
const auth = firebase.auth();
const user = auth.currentUser;
const db = firebase.firestore();

auth.onAuthStateChanged((user) => {
    var menu = document.getElementsByClassName("auth")[0];
    var menu2 = document.getElementsByClassName("auth")[1];
    var signout = `<button id="signout"  class="cssbuttons-io "><span>SignOut</span></button>`;
    var signin = `
                    <a href="https://khudkibook.web.app/signup" class="regBtn">Register</a>
     `;


    // var menu = document.getElementsByClassName("auth")[0];

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
                    // console.log(name, syllabus, semester, branch)


                    // var name = document.getElementById("name");
                    menu.innerHTML += signout;
                    menu2.innerHTML += signout;
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

        menu.innerHTML += signin;
        menu2.innerHTML += signin;


        // window.location.replace("/signup.html");



    }
})
// }
handleResize()









// Feedback

var feedemail = document.getElementById("fedbackemail");
var feedbackl = document.getElementById("fedback");
var post = document.getElementById("postfeed");
var footer = document.getElementById("footer");
var form = document.getElementsByClassName("form")[0];
var error = document.getElementsByClassName("error")[0]

function validateEmail(email) {
    var emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
}
feedemail.addEventListener("input", () => {
    var email = feedemail.value;

    val = validateEmail(email)
    if (val == false) {
        error.innerText = "Enter valid email"
    }
    else {
        error.innerText = ""

    }
})

// Feedback
post.addEventListener("click", async () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    var email = feedemail.value;
    var feedback = feedbackl.value;
    if (email != "" && feedback != "") {
        await db.collection("feedback").doc().set({

            email: feedemail.value,
            feedback: feedbackl.value
        })
        form.innerHTML = `
        <h6 class="ftreh1">Posted !! Thank You For Your Feedback</h6>
        `

    }
    else {

    }


})


// share btn