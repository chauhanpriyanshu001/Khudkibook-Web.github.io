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