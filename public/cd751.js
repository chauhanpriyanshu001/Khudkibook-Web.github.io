
const add = document.getElementById("inp");



fetch("/data.json").then((resposse) => resposse.json()).then((data) => {
  data = data.it.sem1
  datalen = data.length

  for (let index = 0; index < datalen; index++) {

    add.innerHTML += `
            <div class="mc759351">

<div class="mc7593512">
    <img class="mc7593512345" src="${data[index].bookcoverimg}" alt="python gtu book download ">
</div>
<div class="mac75935">
    <h1 class="bn159">${data[index].name}</h1>

    <h1 class="md111">${data[index].subcode}</h1>
    <h1 class="md111">${data[index].credit}</h1>
    
    <div>
        <button class="mdbtn" data-modal-id="modal-1">Book</button>
        <!-- Syllabus -->
        <a href="${data[index].syllabus}">
            <button class="mdbtn">Syllabus</button>
        </a>
        <!-- Button 2 -->
        <button class="mdbtn" data-modal-id="modal-2">Paper</button>
        <!-- Modal 1 -->
        <div class="m741852" id="modal-1">
            <div class="mc7913">
                <span class="mc718293">&times;</span>
                <a href="${data[0].fullbooklink}">Full-Book
                </a>
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

    const bookllink = document.getElementsByClassName("mc7913")[0];
    const booklinklen = data[0].booklink.length

    for (let index = 0; index < booklinklen; index++) {

      bookllink.innerHTML += `
                <a href="${data[0].booklink[index].chapter}">${data[0].booklink[index].name}
                </a>`
    }
    const paperlink = document.getElementsByClassName("mc7913")[1];
    const paperlinklen = data[0].paperlink.length

    for (let index = 0; index < paperlinklen; index++) {

      paperlink.innerHTML += `
                <a href="${data[0].paperlink[index].link}">${data[0].paperlink[index].name}
                </a>`
    }
  }
  // Get all modal buttons
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
  });

})
