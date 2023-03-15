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
