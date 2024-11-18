// var submit = document.getElementById("submit")

// submit.addEventListener("click", () => {
//     var branch = document.getElementById("branch").value
//     var semester = document.getElementById("semester").value
//     if (branch == "it") {
//         if (semester == 1) {
//             window.location.href = "/it/sem1/homepage.html"
//         }
//         else if (semester == 2) {
//             window.location.href = "/it/sem2/homepage.html"
//         }
//         else if (semester == 3) {
//             window.location.href = "/it/sem3/homepage.html"
//         }
//         else if (semester == 4) {
//             window.location.href = "/it/sem4/homepage.html"
//         }
//         else if (semester == 5) {
//             window.location.href = "/it/sem5/homepage.html"
//         }
//         else if (semester == 6) {
//             window.location.href = "/it/sem6/homepage.html"
//         }
//     }
//     else if (branch == "computer") {
//         if (semester == 1) {
//             window.location.href = "/computer/sem1/homepage.html"
//         }
//         else if (semester == 2) {
//             window.location.href = "/computer/sem2/homepage.html"
//         }
//         else if (semester == 3) {
//             window.location.href = "/computer/sem3/homepage.html"
//         }
//         else if (semester == 4) {
//             window.location.href = "/computer/sem4/homepage.html"
//         }
//         else if (semester == 5) {
//             window.location.href = "/computer/sem5/homepage.html"
//         }
//         else if (semester == 6) {
//             window.location.href = "/computer/sem6/homepage.html"
//         }
//     }
//     else if (branch == "civil") {
//         if (semester == 1) {
//             window.location.href = "/civil/sem1/homepage.html"
//         }
//         else if (semester == 2) {
//             window.location.href = "/civil/sem2/homepage.html"
//         }
//         else if (semester == 3) {
//             window.location.href = "/civil/sem3/homepage.html"
//         }
//         else if (semester == 4) {
//             window.location.href = "/civil/sem4/homepage.html"
//         }
//         else if (semester == 5) {
//             window.location.href = "/civil/sem5/homepage.html"
//         }
//         else if (semester == 6) {
//             window.location.href = "/civil/sem6/homepage.html"
//         }
//     }
//     else if (branch == "electrical") {
//         if (semester == 1) {
//             window.location.href = "/electrical/sem1/homepage.html"
//         }
//         else if (semester == 2) {
//             window.location.href = "/electrical/sem2/homepage.html"
//         }
//         else if (semester == 3) {
//             window.location.href = "/electrical/sem3/homepage.html"
//         }
//         else if (semester == 4) {
//             window.location.href = "/electrical/sem4/homepage.html"
//         }
//         else if (semester == 5) {
//             window.location.href = "/electrical/sem5/homepage.html"
//         }
//         else if (semester == 6) {
//             window.location.href = "/electrical/sem6/homepage.html"
//         }
//     }
//     else if (branch == "mechanical") {
//         if (semester == 1) {
//             window.location.href = "/mechanical/sem1/homepage.html"
//         }
//         else if (semester == 2) {
//             window.location.href = "/mechanical/sem2/homepage.html"
//         }
//         else if (semester == 3) {
//             window.location.href = "/mechanical/sem3/homepage.html"
//         }
//         else if (semester == 4) {
//             window.location.href = "/mechanical/sem4/homepage.html"
//         }
//         else if (semester == 5) {
//             window.location.href = "/mechanical/sem5/homepage.html"
//         }
//         else if (semester == 6) {
//             window.location.href = "/mechanical/sem6/homepage.html"
//         }
//     }
//     else {
//         console.log("Unvalid")
//     }
// })


main2 = document.getElementById("mainbooks");
var currentUrl = window.location.href;
var homepage = "https://khudkibook.web.app/";
fetch('/main.json')
    .then(response => response.json())
    .then(data => {
        var totalind = data.home.length;
        console.log(totalind);
        if (currentUrl == homepage) {
            for (let index = 0; index < totalind; index++) {
                console.log(data.home[index]['bookImage']);
                main2.innerHTML += `
                <a href="${data.home[index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data.home[index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data.home[index]['bookName']}</h1>
                    <h1 class="d111">${data.home[index]['bookCode']}</h1>
              <h1 class="d212">Credit-${data.home[index]['bookCredit']}</h1>
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                `
            }
            console.log("Done");

        }



    })
    .catch(error => {
        console.error('Error fetching JSON file:', error);
    });

