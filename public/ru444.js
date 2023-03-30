
let width;

navbar = document.getElementById("nav")
navtag = document.getElementById('nav')



function handleResize() {
    windowWidth = window.innerWidth;
    if (windowWidth <= 700) {
        navtag.classList.remove('rbb');
        navbar.innerHTML = `
        <!-- mobile nav -->

        <div class="navwrap">
            <div class="logo">
                <a href="https://khudkibook.web.app/">
                    <img class="lohh" src="https://khudkibook.web.app/img/bg.png" alt="">
                </a>
            </div>
            <div>
                <a class="textl" href="https://khudkibook.web.app/">

                    Khudkibook
                </a>
            </div>
            <div class="icon">
                <svg class="menuop" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2">
                        <path d="M5 5L12 12L19 5">
                            <animate fill="freeze" attributeName="d" dur="0.4s"
                                values="M5 5L12 12L19 5;M5 5L12 5L19 5" />
                        </path>
                        <path d="M12 12H12">
                            <animate fill="freeze" attributeName="d" dur="0.4s" values="M12 12H12;M5 12H19" />
                        </path>
                        <path d="M5 19L12 12L19 19">
                            <animate fill="freeze" attributeName="d" dur="0.4s"
                                values="M5 19L12 12L19 19;M5 19L12 19L19 19" />
                        </path>
                    </g>
                </svg>
               

            </div>
        </div>
        <div class="navdropdown">
            <ul class="navdul">
                <div class="link">
                <a href="https://khudkibook.web.app/">
                <li class="active">Home</li>
                </a>
                    <div class="list mobilel">
                        <li>I.T</li>
                        <div class="listitem mobileli">
                        <a href="/it/sem1/homepage.html">Sem-1</a>
                        <a href="/it/sem2/homepage.html">Sem-2</a>
                        <a href="/it/sem3/homepage.html">Sem-3</a>
                        <a href="/it/sem4/homepage.html">Sem-4</a>
                        <a href="/it/sem5/homepage.html">Sem-5</a>
                        <a href="/it/sem6/homepage.html">Sem-6</a>
                        </div>


                    </div>
                    <div class="list mobilel">
                        <li>Civil</li>
                        <div class="listitem mobileli">
                        <a href="/civil/sem1/homepage.html">Sem-1</a>
                        <a href="/civil/sem2/homepage.html">Sem-2</a>
                        <a href="/civil/sem3/homepage.html">Sem-3</a>
                        <a href="/civil/sem4/homepage.html">Sem-4</a>
                        <a href="/civil/sem5/homepage.html">Sem-5</a>
                        <a href="/civil/sem6/homepage.html">Sem-6</a>
                        </div>


                    </div>
                    <div class="list mobilel">
                        <li>Electrical</li>
                        <div class="listitem mobileli">
                        <a href="/electical/sem1/homepage.html">Sem-1</a>
                        <a href="/electical/sem2/homepage.html">Sem-2</a>
                        <a href="/electical/sem3/homepage.html">Sem-3</a>
                        <a href="/electical/sem4/homepage.html">Sem-4</a>
                        <a href="/electical/sem5/homepage.html">Sem-5</a>
                        <a href="/electical/sem6/homepage.html">Sem-6</a>
                        </div>


                    </div>
                    <div class="list mobilel">
                        <li>Computer</li>
                        <div class="listitem mobileli">
                        <a href="/computer/sem1/homepage.html">Sem-1</a>
                        <a href="/computer/sem2/homepage.html">Sem-2</a>
                        <a href="/computer/sem3/homepage.html">Sem-3</a>
                        <a href="/computer/sem4/homepage.html">Sem-4</a>
                        <a href="/computer/sem5/homepage.html">Sem-5</a>
                        <a href="/computer/sem6/homepage.html">Sem-6</a>
                        </div>


                    </div>
                    <div class="list mobilel">
                        <li>Mechanical</li>
                        <div class="listitem mobileli">
                        <a href="/mechanical/sem1/homepage.html">Sem-1</a>
                        <a href="/mechanical/sem2/homepage.html">Sem-2</a>
                        <a href="/mechanical/sem3/homepage.html">Sem-3</a>
                        <a href="/mechanical/sem4/homepage.html">Sem-4</a>
                        <a href="/mechanical/sem5/homepage.html">Sem-5</a>
                        <a href="/mechanical/sem6/homepage.html">Sem-6</a>
                        </div>


                    </div>



                    <div class="auth col">
                        <button class="cssbuttons-io ">
                            <span>
                                Signup
                            </span>
                        </button>
                        <button class="cssbuttons-io ">
                            <span>
                                Login
                            </span>
                        </button>
                    </div>
                </div>
            </ul>
        </div>
        `;
        navmenuop = document.querySelector(".menuop")
        navmenucl = document.querySelector(".menucl")
        menuic = document.querySelector(".icon")
        navdropdown = document.querySelector(".navdropdown")
        let val = 0;
        menuic.addEventListener("click", () => {
            if (val == 0) {
                val = 1
                navdropdown.style.display = "block";
                menuic.innerHTML = `
                <svg class="menucl" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24">
                            <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2">
                                <path d="M5 5L12 5L19 5">
                                    <animate fill="freeze" attributeName="d" dur="0.4s"
                                        values="M5 5L12 5L19 5;M5 5L12 12L19 5" />
                                </path>
                                <path d="M5 12H19">
                                    <animate fill="freeze" attributeName="d" dur="0.4s" values="M5 12H19;M12 12H12" />
                                </path>
                                <path d="M5 19L12 19L19 19">
                                    <animate fill="freeze" attributeName="d" dur="0.4s"
                                        values="M5 19L12 19L19 19;M5 19L12 12L19 19" />
                                </path>
                            </g>
                        </svg>
                `

            }
            else if (val == 1) {
                val = 0
                navdropdown.style.display = "none";
                menuic.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"><path d="M5 5L12 12L19 5"><animate fill="freeze" attributeName="d" dur="0.4s" values="M5 5L12 12L19 5;M5 5L12 5L19 5"/></path><path d="M12 12H12"><animate fill="freeze" attributeName="d" dur="0.4s" values="M12 12H12;M5 12H19"/></path><path d="M5 19L12 12L19 19"><animate fill="freeze" attributeName="d" dur="0.4s" values="M5 19L12 12L19 19;M5 19L12 19L19 19"/></path></g></svg>
                `

            }


        })
    }
    else {
        navtag.classList.add('rbb');
        navbar.innerHTML = `
        <div class="navwrap p35">
        <span class="textl">
                            Khudkibook
                        </span>
            <div class="logo">
                <a href="https://khudkibook.web.app/">
                    <span class="bnltl">
                        <img class="lohh" src="https://khudkibook.web.app/img/bg.png" alt="">
                        
                    </span>

                </a>
            </div>
            <div class="auth">
                <button class="cssbuttons-io ">
                    <span>
                        Signup
                    </span>
                </button>
                <button class="cssbuttons-io ">
                    <span>
                        Login
                    </span>
                </button>
            </div>

        </div>
        <div class="link">
            <ul class="row">
                <li class="active"> 
            <a href="https://khudkibook.web.app/">
                
                Home
                </a>
                </li>
                </a>
                <div class="list">
                    <li>I.T</li>
                    <div class="listitem">
                        <a href="/it/sem1/homepage.html">Sem-1</a>
                        <a href="/it/sem2/homepage.html">Sem-2</a>
                        <a href="/it/sem3/homepage.html">Sem-3</a>
                        <a href="/it/sem4/homepage.html">Sem-4</a>
                        <a href="/it/sem5/homepage.html">Sem-5</a>
                        <a href="/it/sem6/homepage.html">Sem-6</a>
                    </div>


                </div>
                <div class="list">
                    <li>Civil</li>
                    <div class="listitem">
                        <a href="/civil/sem1/homepage.html">Sem-1</a>
                        <a href="/civil/sem2/homepage.html">Sem-2</a>
                        <a href="/civil/sem3/homepage.html">Sem-3</a>
                        <a href="/civil/sem4/homepage.html">Sem-4</a>
                        <a href="/civil/sem5/homepage.html">Sem-5</a>
                        <a href="/civil/sem6/homepage.html">Sem-6</a>
                    </div>


                </div>
                <div class="list">
                    <li>Electrical</li>
                    <div class="listitem">
                        <a href="/electrical/sem1/homepage.html">Sem-1</a>
                        <a href="/electrical/sem2/homepage.html">Sem-2</a>
                        <a href="/electrical/sem3/homepage.html">Sem-3</a>
                        <a href="/electrical/sem4/homepage.html">Sem-4</a>
                        <a href="/electrical/sem5/homepage.html">Sem-5</a>
                        <a href="/electrical/sem6/homepage.html">Sem-6</a>
                    </div>


                </div>
                <div class="list">
                    <li>Computer</li>
                    <div class="listitem">
                        <a href="/computer/sem1/homepage.html">Sem-1</a>
                        <a href="/computer/sem2/homepage.html">Sem-2</a>
                        <a href="/computer/sem3/homepage.html">Sem-3</a>
                        <a href="/computer/sem4/homepage.html">Sem-4</a>
                        <a href="/computer/sem5/homepage.html">Sem-5</a>
                        <a href="/computer/sem6/homepage.html">Sem-6</a>
                    </div>


                </div>
                <div class="list">
                    <li>Mechanical</li>
                    <div class="listitem">
                        <a href="/mechanical/sem1/homepage.html">Sem-1</a>
                        <a href="/mechanical/sem2/homepage.html">Sem-2</a>
                        <a href="/mechanical/sem3/homepage.html">Sem-3</a>
                        <a href="/mechanical/sem4/homepage.html">Sem-4</a>
                        <a href="/mechanical/sem5/homepage.html">Sem-5</a>
                        <a href="/mechanical/sem6/homepage.html">Sem-6</a>
                    </div>


                </div>


            </ul>
        </div>
        `
    }
}
handleResize()
window.addEventListener('resize', handleResize);


