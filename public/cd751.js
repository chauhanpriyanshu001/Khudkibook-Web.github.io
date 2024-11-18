main = document.getElementsByTagName("main")[0];
main.innerHTML = ``;
// document.getElementsByClassName("ab12345")[0].innerHTML = '';
// document.getElementsByClassName("ab12345")[1].innerHTML = '';
// document.getElementsByClassName("ab12345")[2].innerHTML = '';
// document.getElementsByClassName("ab12345")[3].innerHTML = '';
// document.getElementsByClassName("ab12345")[4].innerHTML = '';
// document.getElementsByClassName("ab12345")[5].innerHTML = '';

for (let index = 0; index < 6; index++) {
  if (document.getElementsByClassName("ab12345")[index] != undefined) {
    console.log(document.getElementsByClassName("ab12345")[index])
    document.getElementsByClassName("kl789123")[index].innerHTML = `Semester-${index + 1}`;

    document.getElementsByClassName("ab12345")[index].innerHTML = '';
  }
  else {
    console.log(index)
    // element.parentNode.insertBefore(document.getElementsByClassName("ab12345")[index-1])
    document.body.innerHTML += `
    <h1 class="kl789123">Semester-${index + 1}</h1>
    <div class="ab12345"></div>
    `
  }

}
var currentUrl = window.location.href;
var homepage = "https://khudkibook.web.app/";
fetch('/main.json')
  .then(response => response.json())
  .then(data => {
    var totalind = data.it.length;
    console.log(totalind);
    var currentUrl = window.location.href;

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
      console.log(data[branch]);
      console.log(data[branch].length);
      for (let index = 0; index < data[branch].length; index++) {
        console.log(data[branch][index]['bookLink']);
        console.log(window.location.href);
        console.log(data[branch][index]['bookLink'] == window.location.href);
        if (data[branch][index]['bookLink'] == window.location.href) {
          var main = document.getElementsByTagName("main")[0];

          main.innerHTML += `
 <div class="mc759351">

            <div class="mc7593512">
                <img class="mc7593512345" src="${data[branch][index]['bookImage']}" alt="python gtu book download ">
            </div>
            <div class="mac75935">
                <h1 class="bn1599">${data[branch][index]['bookName']}</h1>

                <h1 class="md111">${data[branch][index]['bookCode']}</h1>
                <h1 class="md111">Credit-${data[branch][index]['bookCredit']}</h1>
                <div id='indBooks' >
                    <button class="mdbtn" data-modal-id="modal-1">ENG-Book</button>
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
                    <button class="shrbtn">Share </button>

 <button class="mdbtn" data-modal-id="pay">Help Us</button>

 <div class="m74185201" id="pay">
                        <div class="mc791301" style="background-color:#23192C">
                            <span class="mc718293">&times;</span>
                            <p style="text-align: center; color:white;" >Thank You all for your Positive Feedback. I am alone working on this Website to provide free books to students as much as i can. <br> If possible you can also Help Us to reach more students and help them by donating us. Your money will be used for Buying books and converting to PDF. I am using my Own money right now. </p>
                            <h5 style="font-size: 5vh;color:white;" > Help Us </h5>
                            <img src="https://khudkibook.web.app/img/qrcode.jpeg" alt="donation">
                            <span style="color:white;">Thank You</span>
                            

                        </div>
                    </div>

                </div>
            </div>

        </div>
`;

          indbook = document.getElementById('indBooks');
          var booklink = document.getElementsByClassName('mc7913')[0];
          if (data[branch][index]['booksLink'].length != 0) {
            for (let index2 = 0; index2 < data[branch][index]['booksLink'].length; index2++) {
              console.log('adding book link');
              if (index2 + 1 === data[branch][index]['booksLink'].length) {
                try {

                  booklink.innerHTML += `
                  <a href="${data[branch][index]['booksLink'][index2]}">Full-Book
                  </a>
                  `
                }
                catch (error) {
                  console.log(error);
                }
              }
              else {
                console.log(booklink);
                try {

                  booklink.innerHTML += `
                  <a href="${data[branch][index]['booksLink'][index2]}">Chapter-${index2 + 1}
                  </a>
                  `
                } catch (e) {
                  console.log(e)
                }
              }


            }
          }
          else {
            booklink.innerHTML += `
            <h1 style='Color:Orange;text-align:center' > Comming Soon </h1>
  
            `
          }
          booklink.innerHTML += `
          <h1 style='Color:Orange;text-align:center' >Follow Us On Instagram For Books Updates </h1>
   <a target="_blank" class="instaSbtn" style="color:White;background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); " href="https://www.instagram.com/khudkibook/"> <img style=" width: 4vh; border-radius: 20px;" src="https://cdn.pixabay.com/photo/2021/06/15/12/14/instagram-6338393_640.png" ></img> @Khudkibook</a>
          `;
          if (data[branch][index]['GujbooksLink'] != undefined) {
            indbook.innerHTML += `
  <!-- Button 3 -->
                    <button class="mdbtn" data-modal-id="modal-3">GUJ-Book</button>
                    <!-- Modal 3-->
                    <div class="m741852" id="modal-3">
                        <div class="mc7913">
                            <span class="mc718293">&times;</span>


                        </div>
                    </div>
`;
            booklink = document.getElementsByClassName('mc7913')[2];

            if (data[branch][index]['GujbooksLink'].length != 0) {
              for (let index4 = 0; index4 < data[branch][index]['GujbooksLink'].length; index4++) {
                console.log('adding book link');
                if (index4 + 1 === data[branch][index]['GujbooksLink'].length) {
                  booklink.innerHTML += `
                                    <a href="${data[branch][index]['GujbooksLink'][index4]}">Full-Book
                                   </a>
                                   `
                }
                else {
                  booklink.innerHTML += `
                                    <a href="${data[branch][index]['GujbooksLink'][index4]}">Chapter-${index4 + 1}
                                   </a>
                                   `
                }


              }
            }
            else {
              booklink.innerHTML += `
            <h1 style='Color:Orange;text-align:center' > Comming Soon </h1>
   
            `
            }
            booklink.innerHTML += `
            <h1 style='Color:Orange;text-align:center' >Follow Us On Instagram For Books Updates </h1>
     <a target="_blank" class="instaSbtn" style="color:White;background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); " href="https://www.instagram.com/khudkibook/"> <img style=" width: 4vh; border-radius: 20px;" src="https://cdn.pixabay.com/photo/2021/06/15/12/14/instagram-6338393_640.png" ></img> @Khudkibook</a>
            `;
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

            console.log('adding page link');



            // }
          }
          paperlink.innerHTML += `
          <h1 style='Color:Orange;text-align:center' >Follow Us On Instagram For Books Updates </h1>
   <a target="_blank" class="instaSbtn" style="color:White;background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); " href="https://www.instagram.com/khudkibook/"> <img style=" width: 4vh; border-radius: 20px;" src="https://cdn.pixabay.com/photo/2021/06/15/12/14/instagram-6338393_640.png" ></img> @Khudkibook</a>
          `;
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

          var sharebtn = document.getElementsByClassName('shrbtn')[0];

          sharebtn.addEventListener("click", async () => {
            console.log('clicked')
            // try {
            //   // Copy the element's text content to the clipboard
            //   await navigator.clipboard.writeText(window.location.href);
            //   console.log('Text copied to clipboard!');
            // } catch (err) {
            //   console.error('Failed to copy text: ', err);
            // }
            const shareData = {
              title: "KhudkiBook",
              text: "Get Free Books online like your Friends",
              url: window.location.href.toString(),
            };
            try {
              await navigator.share(shareData);
              resultPara.textContent = "MDN shared successfully";
            } catch (err) {
              resultPara.textContent = `Error: ${err}`;
            }
          })


        }
      }
    }

  })
  .catch(error => {
    console.error('Error fetching JSON file:', error);
  });






// Get all modal buttons
// const modalButtons = document.querySelectorAll(".mdbtn");

// // Loop through each modal button
// modalButtons.forEach((button) => {
//   // Add event listener to button
//   button.addEventListener("click", () => {
//     // Get the modal ID from the data-modal-id attribute
//     const modalId = button.getAttribute("data-modal-id");
//     // Get the modal element
//     const modal = document.getElementById(modalId);
//     // Show the modal
//     modal.style.display = "block";
//     // Add event listener to close button
//     modal.querySelector(".mc718293").addEventListener("click", () => {
//       // Hide the modal
//       modal.style.display = "none";
//     });
//   });
// })



// var sharebtn = document.getElementsByClassName('shrbtn')[0];

// sharebtn.addEventListener("click", async () => {
//   console.log('clicked')
//   // try {
//   //   // Copy the element's text content to the clipboard
//   //   await navigator.clipboard.writeText(window.location.href);
//   //   console.log('Text copied to clipboard!');
//   // } catch (err) {
//   //   console.error('Failed to copy text: ', err);
//   // }
//   const shareData = {
//     title: "KhudkiBook",
//     text: "Get Free Books online like your Friends",
//     url: window.location.href.toString(),
//   };
//   try {
//     await navigator.share(shareData);
//     resultPara.textContent = "MDN shared successfully";
//   } catch (err) {
//     resultPara.textContent = `Error: ${err}`;
//   }
// })

// main = document.getElementById("mainbooks");
var currentUrl2 = window.location.href;
var homepage = "https://khudkibook.web.app/";
fetch('/main.json')
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
              <h1 class="d212">Credit-${data.home[index]['bookCredit']}</h1>
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
      console.log(currentUrl2);
      // currentUrl2 = currentUrl2.substring(currentUrl2.indexOf('/') + 1);
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
                     <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> 
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
                     <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> 
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
                     <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> 
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
                     <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> 
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
                     <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> 
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
                     <h1 class="d212">Credit-${data[branch][index]['bookCredit']}</h1> 
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





