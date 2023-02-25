var cureentLink=window.location.href;
var atcls=document.getElementById("at741");
var home=document.querySelector(".nl753");

function navbar() {
    if (cureentLink == "https://khudkibook.web.app/") {
        var html = '<div id="ab111"><a class="logo" href="/https://khudkibook.web.app/"><img class="logoimg" src="/img/bg.png" alt="khudkibook-logo"></a></div>'
    }
    else {
        var html = '<div id="ab111"><a class="btbtn123" href="javascript:history.back()"><img src="/icons/backblk.png" alt=""></a><a class="logo" href="/index.html"><img class="logoimg" src="/img/bg.png" alt="khudkibook-logo"></a></div>'
    }
    document.getElementById("nav").innerHTML = html;

}
function footer() {
    var html = '<div class="ftriuy"><span> © KhdKibook</span></div>'
    document.getElementById("footer").innerHTML = html;
} 
navbar();
footer();

