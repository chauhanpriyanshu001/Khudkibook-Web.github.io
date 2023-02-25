var slides = document.querySelectorAll('.sl100');
var btns = document.querySelectorAll('.btn');
let currentSlide = 1;

var manualNav = function (manual) {
    slides.forEach((slide)=>{
        slide.classList.remove('ats01');
        btns.forEach((btn)=>{
            btn.classList.remove('ats01');
        })
    })
    slides[manual].classList.add('ats01');
    btns[manual].classList.add('ats01');
}

btns.forEach((btn, i) => {
    btn.addEventListener("click", () => {
        manualNav(i);
        currentSlide = i;
    });
});


var repeat=function(activeClass){
    let active =document.getElementsByClassName('ats01');
    let i =1;

    var repeater = () => {
       
        setTimeout(function(){
            [...active].forEach((activeSlide)=>{
                activeSlide.classList.remove('ats01');
            });
            slides[i].classList.add('ats01');
            btns[i].classList.add('ats01'); 
            i++;

            if(slides.length == i){
                i = 0;
            }
            if(i >= slides.length){
                 return;
            }
            repeater();
        }, 4000);
    }
    repeater();
}
repeat();