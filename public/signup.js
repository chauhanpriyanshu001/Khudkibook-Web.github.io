console.log("Jai Shree Ram")
var username = document.getElementsByTagName("input")[0]
var email = document.getElementsByTagName("input")[1]
var university = document.getElementsByTagName("select")[0]
var course = document.getElementsByTagName("select")[1]
var branch = document.getElementsByTagName("select")[2]
var semester = document.getElementsByTagName("select")[3]
var password = document.getElementsByTagName("input")[2]
var submit = document.getElementsByTagName("input")[3]
var error = document.getElementsByClassName("error")
var number;

const ispass = {
    isusername: false,
    isemail: false,
    isuniversity: false,
    iscourse: false,
    isbranch: false,
    issemester: false,
    ispassword: false
}

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
// Validate username input
function validateUsername(tag) {
    tag.addEventListener("input", function () {
        username = this.value;
        if (username.length <= 2) {
            showError(tag, 0, "Username must be at least 3 characters long.", 'isusername')

        } else if (!/^[a-zA-Z0-9]+$/.test(username)) {
            showError(tag, 0, "Username can only contain letters and numbers.", 'isusername')
        } else {
            showDone(tag, 0, 'isusername')
            const db = firebase.firestore();
            db.collection("users").where("username", "==", username).get()
                .then(querySnapshot => {

                    if (!querySnapshot.empty) {
                        // if the username already exists, throw an error
                        showError(tag, 0, "Username Already taken", 'isusername')

                    }
                    // if the username is available
                    else {
                        showDone(tag, 0, 'isusername')

                    }
                })
        }
    })
}
// Validate Email and phone input


function validateEmail(email) {
    var emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
}
function validateInputEmailMobile(tag) {
    tag.addEventListener("input", function () {
        email = this.value;
        if (email != null) {
            if (validateEmail(email)) {

                if (email.includes(".com")) {

                    const db = firebase.firestore();
                    email = this.value;
                    db.collection("users").where("email", "==", email).get()
                        .then(querySnapshot => {
                            if (!querySnapshot.empty) {
                                // if the email already exists, throw an error
                                showError(tag, 1, "Email Already in use", 'isemail')

                            }
                            else {
                                // if the email is available
                                showDone(tag, 1, 'isemail')

                            }

                        })
                }
                else {
                    showError(tag, 1, "Enter valid email", 'isemail')
                }

            }
            else {
                showError(tag, 1, "Enter valid email", 'isemail')
            }

        }



    })
    //     // Validate all select option
}
// Validate all select option
function validatesSelect(tag4, tag1, tag3, tag2) {



    if (tag4.value == "0") {
        showError(tag4, 2, "Select University", 'isuniversity')
    }
    else {
        showDone(tag4, 2, 'isuniversity')
    }

    if (tag1.value == "0") {
        showError(tag1, 3, "Select Course", 'iscourse')
    }
    else {
        showDone(tag1, 3, 'iscourse')
    }
    // 


    if (tag3.value == "0") {
        showError(tag3, 4, "Select Branch", 'isbranch')
    }
    else {
        showDone(tag3, 4, 'isbranch')
    }


    if (tag2.value == "0") {
        showError(tag2, 5, "Select Semester", 'issemester')
    }
    else {
        showDone(tag2, 5, 'issemester')
    }


}

// Validate password
function validatePassword(tag) {
    tag.addEventListener("input", function () {
        password = this.value;
        if (password.length < 8) {
            showError(tag, 6, "Password must be at least 8 characters long.", 'ispassword')
        } else if (!/\d/.test(password)) {
            showError(tag, 6, "Password must contain at least one number.", 'ispassword')
        } else if (!/[a-zA-Z]/.test(password)) {
            showError(tag, 6, "Password must contain at least one letter.", 'ispassword')
        }
        else {
            showDone(tag, 6, 'ispassword')


        }
    })

}

// validatesSelect(university, course, branch, semester)

validateUsername(username)
validateInputEmailMobile(email)
validatePassword(password)

function send(username, email, university, course, branch, semester, password,) {
    if (username.value == "") { showError(username, 0, "Username Can't be Empty", 'isusername') } else (showDone(username, 0, 'isusername'));
    if (email.value == "") { showError(email, 1, "Email  Can't be Empty", 'isemail') } else (showDone(email, 1, 'isemail'));
    if (password.value == "") { showError(password, 6, "Enter Password", 'ispassword') } else (showDone(password, 6, 'ispassword'));


}
submit.addEventListener("click", function () {
    // send(username, email, university, course, branch, semester, password,)
    validatesSelect(university, course, branch, semester)


    if (ispass.isemail == true) {
        if (ispass.isusername == true && ispass.isbranch == true && ispass.issemester && ispass.ispassword && ispass.iscourse && ispass.isuniversity) {
            signupUsingEmail()



        }
        else {
            console.log(ispass.isusername)
            console.log(ispass.isemail)
            console.log(ispass.isuniversity)
            console.log(ispass.iscourse)
            console.log(ispass.isbranch)
            console.log(ispass.issemester)
            console.log(ispass.ispassword)

        }
    }
    else {
        console.log("Some error")
    }

})

const auth = firebase.auth();
const db = firebase.firestore();

var currentdate = new Date();

function signupUsingEmail() {
    const auth = firebase.auth();
    const db = firebase.firestore();
    auth.createUserWithEmailAndPassword(email, password)
        .then(async (user) => {
            // Signed in 
            var uid = user.user.uid;
            // add user detail in database
            await db.collection("users").doc(uid).set({
                username: username,
                email: email,
                university: university.value,
                course: course.value,
                branch: branch.value,
                semester: semester.value,
                datetime: currentdate,
            })
            await user.user.sendEmailVerification()


        }).then(() => {
            window.location.replace("/verification.html");
            // console.log("OK")

        })


        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorMessage)
        });


}




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