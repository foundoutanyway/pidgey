
(function(){
 var line=document.getElementById('readingLine');
 function progress(){var d=document.documentElement;var max=d.scrollHeight-d.clientHeight;line.style.width=(max?d.scrollTop/max*100:0)+'%'}
 addEventListener('scroll',progress,{passive:true});progress();
 var panel=document.getElementById('bookIndex'),open=document.getElementById('openIndex'),close=document.getElementById('closeIndex');
 function setPanel(on){panel.classList.toggle('open',on);panel.setAttribute('aria-hidden',String(!on));open.setAttribute('aria-expanded',String(on));if(on)close.focus();}
 open.addEventListener('click',function(){setPanel(true)});close.addEventListener('click',function(){setPanel(false)});panel.addEventListener('click',function(e){if(e.target.closest('a'))setPanel(false)});addEventListener('keydown',function(e){if(e.key==='Escape')setPanel(false)});
 if(!document.getElementById('placeFilter'))return;
 var input=document.getElementById('placeFilter'),cards=[].slice.call(document.querySelectorAll('.place')),groups=[].slice.call(document.querySelectorAll('.region-group')),plates=[].slice.call(document.querySelectorAll('.interplate')),empty=document.getElementById('noResults');
 input.addEventListener('input',function(){var q=input.value.trim().toLowerCase(),shown=0;cards.forEach(function(c){var ok=!q||c.getAttribute('data-search').indexOf(q)>-1;c.style.display=ok?'inline-block':'none';if(ok)shown++});plates.forEach(function(p){p.style.display=q?'none':'inline-block'});groups.forEach(function(g){var hasMatch=[].slice.call(g.querySelectorAll('.place')).some(function(c){return c.style.display!=='none'});g.hidden=!!q&&!hasMatch});empty.style.display=shown?'none':'block';});
})();
