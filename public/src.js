
function myText() {
    fetch("data.json").then(response => response.json()).then(data => {
        document.querySelector(".ith").innerText = data.it[0].hit;
        document.querySelector(".cvh").innerText = data.cv[0].hcv;
        document.querySelector(".meh").innerText = data.me[0].hme;
        document.querySelector(".elh").innerText = data.el[0].hel;
        document.querySelector(".cph").innerText = data.cp[0].hcp;

    })
}

myText();