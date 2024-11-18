main = document.getElementsByTagName("main")[0];
var currentUrl = window.location.href;
var homepage = "http://127.0.0.1:5501/testing/index.html";
fetch('/public/main.json')
    .then(response => response.json())
    .then(data => {
        var totalind = data.it.length;
        console.log(totalind);
        console.log(currentUrl);
        currentUrl = currentUrl.substring(8);
        console.log(currentUrl);
        currentUrl = currentUrl.substring(currentUrl.indexOf('/') + 1);
        console.log(currentUrl);
        currentUrl = currentUrl.substring(currentUrl.indexOf('/') + 1);
        var branch = currentUrl.substring(0, currentUrl.indexOf('/'));
        currentUrl = currentUrl.substring(currentUrl.indexOf('/') + 1);

        console.log(branch)
        var sem = currentUrl.substring(0, currentUrl.indexOf('/'))
        console.log(sem)
        // if (currentUrl.includes()) {

        if (currentUrl.includes(sem)) {
            for (let index = 0; index < data[branch].length; index++) {

                if (data[branch][index]['bookLink'] == window.location.href) {
                    main.innerHTML += `
 <div class="mc759351">

            <div class="mc7593512">
                <img class="mc7593512345" src="${data[branch][index]['bookImage']}" alt="python gtu book download ">
            </div>
            <div class="mac75935">
                <h1 class="bn1599">${data[branch][index]['bookName']}</h1>

                <h1 class="md111">${data[branch][index]['bookCode']}</h1>
                <h1 class="md111">Credit-${data[branch][index]['bookCredit']}</h1>
                <div>
                    <button class="mdbtn" data-modal-id="modal-1">Book</button>
                    <!-- Syllabus -->
                    <a href="${data[branch][index]['syllabus']}">
                        <button class="mdbtn">Syllabus</button>
                    </a>
                    <!-- Button 2 -->
                    <button class="mdbtn" data-modal-id="modal-2">Paper</button>
                    <!-- Modal 1 -->
                    <div class="m741852" id="modal-1">
                        <div class="mc7913">
                            <span class="mc718293">&times;</span>
                            
                        </div>
                    </div>
                    <!-- Modal 2 -->
                    <div class="m741852" id="modal-2">
                        <div class="mc7913">
                            <span class="mc718293">&times;</span>


                        </div>
                    </div>


                </div>
            </div>

        </div>
`;
                    booklink = document.getElementsByClassName('mc7913')[0];

                    for (let index2 = 0; index2 < data[branch][index]['booksLink'].length; index2++) {
                        console.log('adding book link');
                        if (index2 + 1 === data[branch][index]['booksLink'].length) {
                            booklink.innerHTML += `
                                <a href="${data[branch][index]['booksLink'][index2]}">Full-Book
                               </a>
                               `
                        }
                        else {
                            booklink.innerHTML += `
                                <a href="${data[branch][index]['booksLink'][index2]}">Chapter-${index2 + 1}
                               </a>
                               `
                        }


                    }
                    paperlink = document.getElementsByClassName('mc7913')[1];

                    for (let index3 = 0; index3 < data[branch][index]['bookPapers'].length; index3++) {
                        // for (let index4 = 1; index4 < data[branch][index]['bookPapers'].length; index4++) {
                        if (index3 % 2 == 0) {
                            paperlink.innerHTML += `
                                <a href="${data[branch][index]['bookPapers'][index3]}">${data[branch][index]['bookPapers'][index3 + 1]}
                               </a>
                               `
                        }

                        // pass
                        //     break
                        // }
                        console.log('adding page link');



                        // }
                    }
                    const modalButtons = document.querySelectorAll(".mdbtn");

                    // Loop through each modal button
                    modalButtons.forEach((button) => {
                        // Add event listener to button
                        button.addEventListener("click", () => {
                            // Get the modal ID from the data-modal-id attribute
                            const modalId = button.getAttribute("data-modal-id");
                            // Get the modal element
                            const modal = document.getElementById(modalId);
                            // Show the modal
                            modal.style.display = "block";
                            // Add event listener to close button
                            modal.querySelector(".mc718293").addEventListener("click", () => {
                                // Hide the modal
                                modal.style.display = "none";
                            });
                        });
                    })


                }
            }
        }

    })
    .catch(error => {
        console.error('Error fetching JSON file:', error);
    });



