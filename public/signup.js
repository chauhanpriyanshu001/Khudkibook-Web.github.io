console.log("Jai Shree Ram")
var username = document.getElementsByTagName("input")[0]
var pname = document.getElementsByTagName("input")[1]
var email = document.getElementsByTagName("input")[2]
var password = document.getElementsByTagName("input")[3]
var confirmpassword = document.getElementsByTagName("input")[4]
var syllabus = document.getElementsByTagName("select")[0]
var branch = document.getElementsByTagName("select")[1]
var semester = document.getElementsByTagName("select")[2]
var submit = document.getElementsByTagName("input")[5]
var error = document.getElementsByClassName("error")
var number;
const ispass = {
    isusername: false,
    ispname: false,
    isemail: false,
    isnumber: false,
    issyllabus: false,
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
        if (username.length <= 6) {
            showError(tag, 0, "Username must be at least 6 characters long.", 'isusername')

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

function validateMobile(mobile) {
    var mobileRegex = /^\d{10}$/;
    return mobileRegex.test(mobile);
}
function validateEmail(email) {
    var emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
}
function validateInputEmailMobile(tag) {
    tag.addEventListener("input", function () {
        email = this.value;
        if (email != null) {
            if (validateMobile(email) || validateEmail(email)) {

                if (email.includes(".com")) {

                    const db = firebase.firestore();
                    email = this.value;
                    db.collection("users").where("email", "==", email).get()
                        .then(querySnapshot => {
                            if (!querySnapshot.empty) {
                                // if the email already exists, throw an error
                                showError(tag, 2, "Email Already in use", 'isemail')

                            }
                            else {
                                // if the email is available
                                showDone(tag, 2, 'isemail')

                            }

                        })
                }
                else {
                    const db = firebase.firestore();
                    number = this.value;
                    db.collection("users").where("number", "==", number).get()
                        .then(querySnapshot => {
                            if (!querySnapshot.empty) {
                                // if the number already exists, throw an error
                                showError(tag, 2, "Number Already in use", 'isnumber')

                            }
                            // if the number is available
                            else {
                                showDone(tag, 2, 'isnumber')

                            }

                        })
                }
            }
            else {
                showError(tag, 2, "Enter your Email or Mobile Number", 'isnumber')
            }
        }
        else {

        }


    })
    // Validate all select option
}
// Validate all select option
function validatesSelect(tag1, tag2, tag3) {
    tag1.addEventListener("input", function () {
        if (tag1.value == "0") {
            showError(tag1, 3, "Select Syllabus", 'issyllabus')
        }
        else {
            showDone(tag1, 3, 'issyllabus')
        }
    })
    tag2.addEventListener("input", function () {
        if (tag2.value == "00") {
            showError(tag2, 4, "Select Branch", 'isbranch')
        }
        else {
            showDone(tag2, 4, 'isbranch')
        }
    })
    tag3.addEventListener("input", function () {
        if (tag3.value == "000") {
            showError(tag3, 5, "Select Semester", 'issemester')
        }
        else {
            showDone(tag3, 5, 'issemester')
        }
    })
}

// Validate password
function validatePassword(tag, cp) {
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
            cp.addEventListener("input", function () {
                confirmpassword = this.value;
                if (password != confirmpassword) {

                    showError(cp, 7, "Confirm Password Did'nt Match", 'ispassword')
                    showDone(tag, 6, 'ispassword')
                }
                else {
                    showDone(tag, 6, 'ispassword')
                    showDone(cp, 7, 'ispassword')

                }
            })

        }
    })

}
validateUsername(username)
validateInputEmailMobile(email)
validatesSelect(syllabus, branch, semester)
validatePassword(password, confirmpassword)
function send(username, email, pname, syllabus, branch, semester, password, confirmpassword) {
    if (username.value == "") { showError(username, 0, "Username Can't be Empty", 'isusername') } else (showDone(username, 0, 'isusername'));
    if (pname.value == "") { showError(pname, 1, "Name  Can't be Empty", 'ispname') } else (showDone(pname, 1, 'ispname'));
    if (email.value == "") { showError(email, 2, "Email or Number Can't be Empty", 'isemail') } else (showDone(email, 2, 'isemail'));
    if (syllabus.value == "0") { showError(syllabus, 3, "Select", 'issyllabus') } else (showDone(syllabus, 3, 'issyllabus'));
    if (branch.value == "00") { showError(branch, 4, "Select", 'isbranch') } else (showDone(branch, 4, 'isbranch'));
    if (semester.value == "000") { showError(semester, 5, "Select", 'issemester') } else (showDone(semester, 5, 'issemester'));
    if (password.value == "") { showError(password, 6, "Enter Password", 'ispassword') } else (showDone(password, 6, 'ispassword'));
    if (confirmpassword.value == "") { showError(confirmpassword, 7, "Enter confirmPassword", 'ispassword') }
}
submit.addEventListener("click", function () {
    // send(username, email, pname, syllabus, branch, semester, password, confirmpassword)

    if (ispass.isemail == true || ispass.isnumber == true) {
        if (ispass.isusername == true && ispass.isbranch == true && ispass.issemester && ispass.ispassword && ispass.issyllabus) {
            signupUsingEmail()



        }
        else {
            console.log(ispass.isusername)
            console.log(ispass.ispname)
            console.log(ispass.isemail)
            console.log(ispass.issyllabus)
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
                name: pname.value,
                email: email,
                syllabus: syllabus.value,
                branch: branch.value,
                semester: semester.value,
            })
            await user.user.sendEmailVerification()


        }).then(() => {
            window.location.replace("/verification.html");
            console.log("OK")

        })


        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log(errorMessage)
        });


}




