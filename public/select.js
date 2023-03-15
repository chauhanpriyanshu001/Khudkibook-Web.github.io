console.log("Jai Jai shree Ram")

var submit = document.getElementById("submit")

submit.addEventListener("click", () => {
    var branch = document.getElementById("branch").value
    var semester = document.getElementById("semester").value
    if (branch == "it") {
        if (semester == 1) {
            window.location.href = "/it/sem1/homepage.html"
        }
        else if (semester == 2) {
            window.location.href = "/it/sem2/homepage.html"
        }
        else if (semester == 3) {
            window.location.href = "/it/sem3/homepage.html"
        }
        else if (semester == 4) {
            window.location.href = "/it/sem4/homepage.html"
        }
        else if (semester == 5) {
            window.location.href = "/it/sem5/homepage.html"
        }
        else if (semester == 6) {
            window.location.href = "/it/sem6/homepage.html"
        }
    }
    else if (branch == "computer") {
        if (semester == 1) {
            window.location.href = "/computer/sem1/homepage.html"
        }
        else if (semester == 2) {
            window.location.href = "/computer/sem2/homepage.html"
        }
        else if (semester == 3) {
            window.location.href = "/computer/sem3/homepage.html"
        }
        else if (semester == 4) {
            window.location.href = "/computer/sem4/homepage.html"
        }
        else if (semester == 5) {
            window.location.href = "/computer/sem5/homepage.html"
        }
        else if (semester == 6) {
            window.location.href = "/computer/sem6/homepage.html"
        }
    }
    else if (branch == "civil") {
        if (semester == 1) {
            window.location.href = "/civil/sem1/homepage.html"
        }
        else if (semester == 2) {
            window.location.href = "/civil/sem2/homepage.html"
        }
        else if (semester == 3) {
            window.location.href = "/civil/sem3/homepage.html"
        }
        else if (semester == 4) {
            window.location.href = "/civil/sem4/homepage.html"
        }
        else if (semester == 5) {
            window.location.href = "/civil/sem5/homepage.html"
        }
        else if (semester == 6) {
            window.location.href = "/civil/sem6/homepage.html"
        }
    }
    else if (branch == "electrical") {
        if (semester == 1) {
            window.location.href = "/electrical/sem1/homepage.html"
        }
        else if (semester == 2) {
            window.location.href = "/electrical/sem2/homepage.html"
        }
        else if (semester == 3) {
            window.location.href = "/electrical/sem3/homepage.html"
        }
        else if (semester == 4) {
            window.location.href = "/electrical/sem4/homepage.html"
        }
        else if (semester == 5) {
            window.location.href = "/electrical/sem5/homepage.html"
        }
        else if (semester == 6) {
            window.location.href = "/electrical/sem6/homepage.html"
        }
    }
    else if (branch == "mechanical") {
        if (semester == 1) {
            window.location.href = "/mechanical/sem1/homepage.html"
        }
        else if (semester == 2) {
            window.location.href = "/mechanical/sem2/homepage.html"
        }
        else if (semester == 3) {
            window.location.href = "/mechanical/sem3/homepage.html"
        }
        else if (semester == 4) {
            window.location.href = "/mechanical/sem4/homepage.html"
        }
        else if (semester == 5) {
            window.location.href = "/mechanical/sem5/homepage.html"
        }
        else if (semester == 6) {
            window.location.href = "/mechanical/sem6/homepage.html"
        }
    }
    else {
        console.log("Unvalid")
    }
})