'use strict';
(() => {
  const $=s=>document.querySelector(s);
  const sections=[...document.querySelectorAll('article section[id]')];
  const links=[...document.querySelectorAll('.toc a[href^="#"]')];
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const toc=$('.toc details');
  if(toc&&matchMedia('(max-width:800px)').matches)toc.open=false;
  function progress(){
    const max=document.documentElement.scrollHeight-innerHeight;
    const value=max>0?Math.min(100,Math.max(0,scrollY/max*100)):100;
    if($('.reading-progress'))$('.reading-progress').style.width=value+'%';
    if($('#reading-percent'))$('#reading-percent').textContent=Math.round(value)+'%';
    if($('#reading-meter'))$('#reading-meter').value=value;
  }
  let queued=false;
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(()=>{progress();queued=false;});}},{passive:true});
  addEventListener('resize',progress);progress();
  let active=0;
  function activate(index){
    active=index;links.forEach(a=>{if(a.hash==='#'+sections[index].id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    if($('#prev-topic'))$('#prev-topic').disabled=index===0;
    if($('#next-topic'))$('#next-topic').disabled=index===sections.length-1;
  }
  if(sections.length)activate(0);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible[0])activate(sections.indexOf(visible[0].target));},{rootMargin:'-12% 0px -65% 0px'});
    sections.forEach(s=>observer.observe(s));
  }
  function jump(index){if(sections[index]){activate(index);sections[index].scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});sections[index].setAttribute('tabindex','-1');sections[index].focus({preventScroll:true});}}
  if($('#prev-topic'))$('#prev-topic').addEventListener('click',()=>jump(active-1));
  if($('#next-topic'))$('#next-topic').addEventListener('click',()=>jump(active+1));
  links.forEach(a=>a.addEventListener('click',()=>{if(toc&&matchMedia('(max-width:800px)').matches)toc.open=false;}));
  if($('#topic-search'))$('#topic-search').addEventListener('input',e=>{
    const term=e.target.value.trim().toLocaleLowerCase();
    links.forEach(a=>a.hidden=!a.textContent.toLocaleLowerCase().includes(term));
    const empty=$('#toc-empty');if(empty)empty.hidden=links.some(a=>!a.hidden);
  });
  let size=17;
  try{const saved=Number(localStorage.getItem('kb-dsa-font-size'));if(saved>=16&&saved<=21)size=saved;}catch(e){}
  function setSize(next){size=Math.min(21,Math.max(16,next));document.body.style.setProperty('--kb-size',size+'px');if($('#font-size-label'))$('#font-size-label').textContent=size+'px';if($('#font-smaller'))$('#font-smaller').disabled=size===16;if($('#font-larger'))$('#font-larger').disabled=size===21;try{localStorage.setItem('kb-dsa-font-size',size);}catch(e){}}
  setSize(size);
  if($('#font-smaller'))$('#font-smaller').addEventListener('click',()=>setSize(size-1));
  if($('#font-larger'))$('#font-larger').addEventListener('click',()=>setSize(size+1));
  const answers=[...document.querySelectorAll('#exam details')];
  const answerButton=$('#toggle-answers');
  function answerLabel(){if(answerButton){const all=answers.length>0&&answers.every(d=>d.open);answerButton.textContent=all?'Hide all answers':'Show all answers';answerButton.setAttribute('aria-expanded',String(all));}}
  answers.forEach(d=>d.addEventListener('toggle',answerLabel));
  if(answerButton)answerButton.addEventListener('click',()=>{const open=!answers.every(d=>d.open);answers.forEach(d=>d.open=open);answerLabel();});
  let saved=[];
  function prepare(){if(saved.length)return;saved=[...document.querySelectorAll('article details')].map(d=>({d,open:d.open}));saved.forEach(({d})=>d.open=true);}
  function restore(){saved.forEach(({d,open})=>d.open=open);saved=[];answerLabel();}
  addEventListener('beforeprint',prepare);addEventListener('afterprint',restore);
  const button=$('#save-pdf'),status=$('#pdf-status');
  if(button)button.addEventListener('click',async()=>{
    button.disabled=true;if(status)status.textContent='Preparing your PDF…';
    try{
      const images=[...document.querySelectorAll('.print-watermark img')];
      await Promise.all(images.map(img=>img.decode?img.decode():Promise.resolve()));
      if(images.some(img=>!img.complete||!img.naturalWidth))throw new Error('Logo unavailable');
      prepare();window.print();
      if(status)status.textContent='Choose “Save as PDF” in the print dialog.';
    }catch(e){restore();if(status)status.textContent='Could not prepare the PDF. Reload the page and try again.';}
    finally{button.disabled=false;}
  });
})();
