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
                                var university = user.university;
                                var semester = user.semester;
                                var branch = user.branch;
                                var userver = firebase.auth().currentUser.emailVerified;
                                if (userver) {
                                    if (user)
                                        if (university == "GTU") {
                                            var url = "https://khudkibook.web.app/" + branch + "/sem" + semester + "/homepage";
                                            window.location.replace(url)

                                        } else {
                                            console.log("Some Problem Ocuured");
                                        }
                                }
                                else {
                                    window.location.replace("/verification.html")
                                }




                            } else {
                                console.log("No such document!");
                            }
                        })
                        .catch(error => {
                            console.log("Error getting document:", error);
                        });

                } else {

                }

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
                // if the email is available
                showError(tag, 0, "User not found", 'isemail')

            }
        }
        else {

        }


    })
}




// Validate all select option


validateInputEmailUsername(username)
// Hide and Show Password
var shpass = document.getElementById("showhidepass");
var inppass = document.getElementById("passinp");
shpass.addEventListener("click", () => {
    if (inppass.type == "password") {

        inppass.type = "text";
        shpass.innerText = "Hide Password"
    }
    else {
        inppass.type = "password";
        shpass.innerText = "Show Password "
    }
})