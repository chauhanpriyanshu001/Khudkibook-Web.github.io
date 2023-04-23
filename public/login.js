var username = document.getElementsByTagName("input")[0]
var password = document.getElementsByTagName("input")[1]
var submit = document.getElementsByTagName("input")[2]
var error = document.getElementsByClassName("error")
const ispass = {
    isusername: false,
    ispassword: false
}
var email;
// show error 
function showError(tag, i, state, controller) {
    tag.style.borderBottomColor = "red";
    error[i].innerText = state
    error[i].style.display = "block"
    ispass[controller] = false;
}
// show done
function showDone(tag, i, controllerd) {
    tag.style.borderBottomColor = "green";
    error[i].innerText = ""
    error[i].style.display = "none"
    ispass[controllerd] = true;
}

// Validate email
function validateEmail(email) {
    var emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
}
const auth = firebase.auth()

function logIn(email) {
    submit.addEventListener("click", () => {
        auth.signInWithEmailAndPassword(email, password.value)
            .then((userCredential) => {
                // Signed in 
                const user = userCredential.user;
                const db = firebase.firestore();

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
                                if (syllabus == "GTU") {
                                    if (branch == "it") {
                                        if (semester == "1") {
                                            window.location.replace("https://khudkibook.web.app/it/sem1/homepage")
                                        }
                                        else if (semester == "2") {
                                            window.location.replace("https://khudkibook.web.app/it/sem2/homepage")
                                        }
                                        else if (semester == "3") {
                                            window.location.replace("https://khudkibook.web.app/it/sem3/homepage")
                                        }
                                        else if (semester == "4") {
                                            window.location.replace("https://khudkibook.web.app/it/sem4/homepage")
                                        }
                                    }
                                    else if (branch == "computer") {
                                        if (semester == "1") {
                                            window.location.replace("https://khudkibook.web.app/computer/sem1/homepage")
                                        }
                                        else if (semester == "2") {
                                            window.location.replace("https://khudkibook.web.app/computer/sem2/homepage")
                                        }
                                        else if (semester == "3") {
                                            window.location.replace("https://khudkibook.web.app/computer/sem3/homepage")
                                        }
                                        else if (semester == "4") {
                                            window.location.replace("https://khudkibook.web.app/computer/sem4/homepage")
                                        }
                                    }
                                    else if (branch == "electrical") {
                                        if (semester == "1") {
                                            window.location.replace("https://khudkibook.web.app/electrical/sem1/homepage")
                                        }
                                        else if (semester == "2") {
                                            window.location.replace("https://khudkibook.web.app/electrical/sem2/homepage")
                                        }
                                        else if (semester == "3") {
                                            window.location.replace("https://khudkibook.web.app/electrical/sem3/homepage")
                                        }
                                        else if (semester == "4") {
                                            window.location.replace("https://khudkibook.web.app/electrical/sem4/homepage")
                                        }
                                    }
                                    else if (branch == "mechanical") {
                                        if (semester == "1") {
                                            window.location.replace("https://khudkibook.web.app/mechanical/sem1/homepage")
                                        }
                                        else if (semester == "2") {
                                            window.location.replace("https://khudkibook.web.app/mechanical/sem2/homepage")
                                        }
                                        else if (semester == "3") {
                                            window.location.replace("https://khudkibook.web.app/mechanical/sem3/homepage")
                                        }
                                        else if (semester == "4") {
                                            window.location.replace("https://khudkibook.web.app/mechanical/sem4/homepage")
                                        }
                                    }
                                    else if (branch == "civil") {
                                        if (semester == "1") {
                                            window.location.replace("https://khudkibook.web.app/civil/sem1/homepage")
                                        }
                                        else if (semester == "2") {
                                            window.location.replace("https://khudkibook.web.app/civil/sem2/homepage")
                                        }
                                        else if (semester == "3") {
                                            window.location.replace("https://khudkibook.web.app/civil/sem3/homepage")
                                        }
                                        else if (semester == "4") {
                                            window.location.replace("https://khudkibook.web.app/civil/sem4/homepage")
                                        }
                                    }
                                }

                                // var name = document.getElementById("name");
                                menu.innerHTML += '<button id="signout"> Sign out</button>'
                                var signuotbtn = document.getElementById("signout");
                                function signoutf() {
                                    auth.signOut().then(() => {
                                        // Sign-out 
                                        window.location.replace("/signup.html");

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
                    // menu.innerHTML += '<a  href="/login.html">LogIn</a> <a href="/signup.html"> SignUp </a>'
                    // window.location.replace("/signup.html");
                }
                // ...
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.log(errorMessage)
            });

    })
}
function validateInputEmailUsername(tag) {
    tag.addEventListener("blur", function () {
        email = this.value;
        if (email != null) {

            if (email.includes(".com")) {

                const db = firebase.firestore();
                email = this.value;
                db.collection("users").where("email", "==", email).get()
                    .then(querySnapshot => {
                        if (!querySnapshot.empty) {
                            // if the email already exists
                            showDone(tag, 0, 'isemail')
                            // Log in
                            logIn(email)


                        }
                        else {
                            // if the email is available
                            showError(tag, 0, "User not found", 'isemail')

                        }

                    })
            }
            else {
                const db = firebase.firestore();
                username = this.value;
                db.collection("users").where("username", "==", username).get()
                    .then(querySnapshot => {

                        if (!querySnapshot.empty) {
                            // if the username already exists
                            showDone(tag, 0, 'isusername')

                            // Search for documents where the "username" field matches the given value
                            db.collection("users").where("username", "==", username)
                                .get()
                                .then(function (querySnapshot) {
                                    querySnapshot.forEach(function (doc) {
                                        doc = doc.id;
                                        db.collection("users").doc(doc)
                                            .get()
                                            .then(function (doc) {
                                                if (doc.exists) {
                                                    var data = doc.data();
                                                    var utemail = data.email;
                                                    // Log in
                                                    logIn(utemail)

                                                } else {
                                                    console.error("No such document!");
                                                }
                                            })
                                            .catch(function (error) {
                                                console.error("Error retrieving document: ", error);
                                            });
                                    })
                                })
                                .catch(function (error) {
                                    console.error("Error searching for document: ", error);
                                });

                        }
                        // if the username is available
                        else {
                            showError(tag, 0, "No User Found", 'isusername')

                        }
                    })
            }
        }
        else {

        }


    })
}




// Validate all select option


validateInputEmailUsername(username)
