// main = document.getElementById("mainbooks");
var currentUrl2 = window.location.href;
var homepage = "http://127.0.0.1:5501/testing/index.html";
fetch('/public/main.json')
    .then(response => response.json())
    .then(data => {
        var totalind = data.home.length;
        console.log(totalind);
        if (currentUrl2 == homepage) {
            for (let index = 0; index < totalind; index++) {
                console.log(data.home[index]['bookImage']);
                main.innerHTML += `
                <a href="${data.home[index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data.home[index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data.home[index]['bookName']}</h1>
                    <h1 class="d111">${data.home[index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data.home[index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                `
            }
            console.log("Done");

        }
        else {
            console.log(data.it);
            console.log(currentUrl2);
            currentUrl2 = currentUrl2.substring(8);
            console.log(currentUrl2);
            currentUrl2 = currentUrl2.substring(currentUrl2.indexOf('/') + 1);
            currentUrl2 = currentUrl2.substring(currentUrl2.indexOf('/') + 1);
            console.log(currentUrl2);
            var branch = currentUrl2.substring(0, currentUrl2.indexOf('/'));
            currentUrl2 = currentUrl2.substring(currentUrl2.indexOf('/') + 1);

            console.log(branch)
            var sem = currentUrl2.substring(0, currentUrl2.indexOf('/'))
            console.log(sem)
            for (let index = 0; index < data[branch].length; index++) {
                // var checkurl = "/" + branch + "/" + sem;
                // console.log(checkurl);
                // if (data[branch][index]['bookHomeLink'].includes(checkurl)) {

                // }
                // var ind = index + 1;
                // var check = "sem" + ind;
                // console.log(check);

                if ("sem1" == data[branch][index]['sem']) {
                    var addin = document.getElementsByClassName("ab12345")[0];
                    addin.innerHTML += `
                     <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                    `;

                }
                else if ("sem2" == data[branch][index]['sem']) {
                    var addin = document.getElementsByClassName("ab12345")[1];

                    addin.innerHTML += `
                     <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                    `;
                }
                else if ("sem3" == data[branch][index]['sem']) {
                    var addin = document.getElementsByClassName("ab12345")[2];

                    addin.innerHTML += `
                     <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                    `;
                }
                else if ("sem4" == data[branch][index]['sem']) {
                    var addin = document.getElementsByClassName("ab12345")[3];

                    addin.innerHTML += `
                     <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                    `;
                }
                else if ("sem5" == data[branch][index]['sem']) {
                    var addin = document.getElementsByClassName("ab12345")[4];

                    addin.innerHTML += `
                     <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                    `;
                }
                else if ("sem6" == data[branch][index]['sem']) {
                    var addin = document.getElementsByClassName("ab12345")[5];

                    addin.innerHTML += `
                     <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                    <!-- <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> -->
                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
                    `;
                }
            }


        }



    })
    .catch(error => {
        console.error('Error fetching JSON file:', error);
    });




