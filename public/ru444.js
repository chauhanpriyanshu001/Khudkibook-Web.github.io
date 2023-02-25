var cureentLink=window.location.href;
var atcls=document.getElementById("at741");
var home=document.querySelector(".nl753");

function navbar() {
    // if(cureentLink=="http://127.0.0.1:5500/index.html"){
    //     var html = '<div id="ab111"><a class="logo" href="/index.html"><img class="logoimg" src="/img/bg.png" alt="khudkibook-logo"></a><div class="ni157"><ul><li><a  id="at741" class="nl753" href="/index.html">Home</a></li></ul></div><div class="ni157"><ul><li><a id="" class="nl753" href="/syllabus.html">Syllabus</a></li></ul></div><div class="ni157"><ul><li><a id="" class="nl753" href="/papers.html">Papers</a> </li></ul></div></div>'
    //   }
    //  else if(cureentLink=="http://127.0.0.1:5500/syllabus.html"){
    //     var html = '<div id="ab111"><a class="logo" href="/index.html"><img class="logoimg" src="/img/bg.png" alt="khudkibook-logo"></a><div class="ni157"><ul><li><a  id="" class="nl753" href="/index.html">Home</a></li></ul></div><div class="ni157"><ul><li><a id="at741" class="nl753" href="/syllabus.html">Syllabus</a></li></ul></div><div class="ni157"><ul><li><a id="" class="nl753" href="/papers.html">Papers</a> </li></ul></div></div>'
    //   }
    //  else if(cureentLink=="http://127.0.0.1:5500/papers.html"){
    //     var html = '<div id="ab111"><a class="logo" href="/index.html"><img class="logoimg" src="/img/bg.png" alt="khudkibook-logo"></a><div class="ni157"><ul><li><a  id="" class="nl753" href="/index.html">Home</a></li></ul></div><div class="ni157"><ul><li><a id="" class="nl753" href="/syllabus.html">Syllabus</a></li></ul></div><div class="ni157"><ul><li><a id="at741" class="nl753" href="/papers.html">Papers</a> </li></ul></div></div>'
    //   }
    //  else{

         var html = '<div id="ab111"><a class="btbtn123" href="javascript:history.back()"><img src="/icons/backblk.png" alt=""></a><a class="logo" href="/index.html"><img class="logoimg" src="/img/bg.png" alt="khudkibook-logo"></a><button class="mbtnt3w3"><img src="/icons/menu.png" alt=""></button></div>'
        //  <a href="javascript:history.back()">Back</a>
          
        
    //  }
    document.getElementById("nav").innerHTML = html;

}
function footer() {
    var html = '<h1 class="kft789123">--- @KhudKibook ---</h1>'
    document.getElementById("footer").innerHTML = html;
} 
navbar();
footer();

