console.log("Jai shree Ram")

var branch=document.getElementById("branch")
var semester=document.getElementById("semester")
var year=document.getElementById("year")
var submit=document.getElementById("submit")
var head=document.querySelectorAll(".contenthh")
var table=document.getElementById("table")
submit.addEventListener("click",()=>{
   branch= head[0].innerHTML=branch.value
   semester=  head[1].innerHTML=semester.value
   year= head[2].innerHTML=year.value

    if(branch=="none" || semester=="none" || year=="none"){}
    if(branch=="it" || semester=="3" || year=="2021-22"){
        var html=' <tr><th>Subject</th><th>Marks</th><th>Credit</th><th>Download</th></tr><tr> <td>Advance Python Programming</td> <td>150</td><td>5</td><td> <a href="#">Download</a> </td> </tr>    <tr><td>Linux Operating System</td><td>150</td><td>5</td><td> <a href="#">Download</a> </td></tr><tr><td>Database Management</td><td>150</td><td>5</td> <td> <a href="#">Download</a> </td> </tr><tr> <td>Fundamental of Software Development</td> <td>150</td> <td>4</td><td> <a href="#">Download</a> </td> </tr> <tr> <td>Seminar</td><td>50</td> <td>2</td> <td> <a href="#">Download</a> </td></tr>'
table.innerHTML+=html
        
    }

})