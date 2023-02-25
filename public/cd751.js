// Get the modal
var modal = document.getElementById("m1111");

// Get the button that opens the modal
var btn = document.getElementById("mbt75935147");

// Get the close button
var closeBtn = document.getElementsByClassName("mc718293")[0];

// When the user clicks the button, open the modal 
btn.onclick = function() {
  modal.style.display = "flex";
}

// When the user clicks on the close button or outside of the modal, close it
closeBtn.onclick = function() {
  modal.style.display = "none";
}

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}
