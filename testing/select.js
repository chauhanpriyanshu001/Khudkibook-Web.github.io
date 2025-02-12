

main2 = document.getElementById("mainbooks");
var currentUrl = window.location.href;
var homepage = "http://127.0.0.1:5501/testing/index.html";
fetch('/testing/home_common.json')
    .then(response => response.json())
    .then(data => {
        var totalind = data.home.length;
        // console.log(totalind);
        if (currentUrl == homepage) {
            for (let index = 0; index < totalind; index++) {
                // console.log(data.home[index]['bookImage']);
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
            // console.log("Done");

        }



    })
    .catch(error => {
        // console.error('Error fetching JSON file:', error);
    });

