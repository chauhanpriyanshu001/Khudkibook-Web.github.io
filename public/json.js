main = document.getElementById("main");

fetch('index.json')
    .then(response => response.json())
    .then(data => {
        // Here, `data` will contain the parsed JSON data
        data = data;
        console.log(data.button)
        main.innerHTML += `<a href="${data.common.english.pagelink}"><div class="abc123456">
        <img class="i12345" src="${data.common.english.img}" alt="" srcset="">
        <div class="mali147852">
            <div><h1 class="bn159">${data.common.english.subjectname}</h1>
            </div><div>
                <h1 class="d111">${data.common.english.sem}</h1>
                <h1 class="d212">${data.common.english.branch}</h1>
            </div>
            <div>
            
                <input class="kpb789123" type="button" value='Open'>
            </div>
        </div>


    </div>

</a>`


    })
    .catch(error => {
        console.error('Error fetching JSON file:', error);
    });




