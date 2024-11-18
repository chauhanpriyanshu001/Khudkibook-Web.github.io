// Syllabus
table = document.getElementById("table")
drpsy = document.getElementById("sydrp")
icdrs = document.getElementById("sydrpi")
let now = 0;
drpsy.addEventListener("click", () => {
    if (now == 0) {
        now = 1
        table.style.display = "revert";
        icdrs.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/></svg>
        `
    }
    else {
        now = 0
        table.style.display = "none";
        icdrs.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"> <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        `

    }
})


main = document.getElementById("main");
var currentUrl = window.location.href;

fetch('/main.json')
    .then(response => response.json())
    .then(data => {

        console.log(currentUrl);
        currentUrl = currentUrl.substring(8);
        console.log(currentUrl);
        currentUrl = currentUrl.substring(currentUrl.indexOf('/') + 1);
        console.log(currentUrl);
        // currentUrl = currentUrl.substring(currentUrl.indexOf('/') + 1);
        var branch = currentUrl.substring(0, currentUrl.indexOf('/'));
        currentUrl = currentUrl.substring(currentUrl.indexOf('/') + 1);

        console.log(branch)
        var sem = currentUrl.substring(0, currentUrl.indexOf('/'))
        console.log(sem)
        // if (currentUrl.includes()) {

        if (currentUrl.includes(sem)) {
            for (let index = 0; index < data[branch].length; index++) {

                if (data[branch][index]['bookHomeLink'] == window.location.href) {
                    main.innerHTML += `
 <a href="${data[branch][index]['bookLink']}">
            <div class="abc123456">
                <img class="i12345" src=${data[branch][index]['bookImage']} alt="BE gtu english book download ">
                <div class="mali147852">
                    <h1 class="bn159">${data[branch][index]['bookName']}</h1>
                    <h1 class="d111">${data[branch][index]['bookCode']}</h1>
                        <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1>


                    <input class="kpb789123" type="button" value="Open">
                </div>


            </div>
        </a>
`;


                }
            }

            // Loop through each modal button

        }


    })
    .catch(error => {
        console.error('Error fetching JSON file:', error);
    });



