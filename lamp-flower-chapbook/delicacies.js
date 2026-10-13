/* The delicacies page's quick reference. Added 2026-10-13 at her word, "can we build all 3?".
   Three things keep the box from growing with every note:
   1. a long group shows its newest rows, and a button in its heading brings back the earlier ones;
   2. a button on the top line puts the whole list away, and on a phone it starts put away;
   3. a find field narrows the rows in the box and the notes on the page together.
   Without this script the box shows every row, open, and has no find field. */
/* A card's picture opens large over the page. Added the same day at her word, "yeah do 1-5". The
   picture on a card is a link to its larger copy, so without this script, or in a browser with
   no dialog, the link opens the picture by itself. */
(function(){
 var page=document.getElementById('delicacies');
 if(!page||!window.HTMLDialogElement)return;
 var dlg=null,img=null;
 page.addEventListener('click',function(e){
  var link=e.target.closest?e.target.closest('a.deli-zoom'):null;
  if(!link||e.ctrlKey||e.metaKey||e.shiftKey||e.button)return;
  e.preventDefault();
  if(!dlg){
   dlg=document.createElement('dialog');dlg.className='deli-zoomed';
   img=document.createElement('img');
   var close=document.createElement('button');close.type='button';close.textContent=page.getAttribute('data-close')||'Close';
   dlg.appendChild(img);dlg.appendChild(close);document.body.appendChild(dlg);
   close.addEventListener('click',function(){dlg.close()});
   // a press on the picture, or on the dark around the box, puts it away
   dlg.addEventListener('click',function(ev){if(ev.target===dlg||ev.target===img)dlg.close()});
  }
  var small=link.querySelector('img');
  img.alt=small?small.alt:'';img.src=link.href;
  dlg.showModal();
 });
})();

(function(){
 var box=document.getElementById('delicacies-quick');
 if(!box)return;

 // 1. The long groups. The build marks a long group's earlier rows and leaves its button hidden.
 [].forEach.call(box.querySelectorAll('.deli-toc-more'),function(btn){
  var block=btn.closest('.deli-toc-b');
  function fold(on){block.classList.toggle('is-folded',on);btn.setAttribute('aria-expanded',String(!on));btn.textContent=btn.getAttribute(on?'data-more':'data-less')}
  btn.hidden=false;fold(true);
  btn.addEventListener('click',function(){fold(!block.classList.contains('is-folded'))});
 });

 // 2. The whole list. A link back up to the box from a group's heading opens it again.
 var toggle=box.querySelector('.deli-toc-toggle');
 function shut(on){box.classList.toggle('is-shut',on);toggle.setAttribute('aria-expanded',String(!on));toggle.textContent=toggle.getAttribute(on?'data-shut':'data-open')}
 if(toggle){
  toggle.hidden=false;
  shut(matchMedia('(max-width:640px)').matches&&location.hash!=='#delicacies-quick');
  toggle.addEventListener('click',function(){shut(!box.classList.contains('is-shut'))});
  document.addEventListener('click',function(e){
   var up=e.target.closest?e.target.closest('a[href="#delicacies-quick"]'):null;
   if(up)shut(false);
  });
 }

 // 3. The find field. A note matches when every word typed is somewhere in its card, its whole
 //    note included, or in its group's name. Accents are set aside, so "mure" finds "mûre".
 var wrap=box.querySelector('.deli-find'),input=document.getElementById('deliFind'),none=document.getElementById('deliNone');
 if(!wrap||!input)return;
 function plain(s){s=s.toLowerCase();return s.normalize?s.normalize('NFD').replace(/[̀-ͯ]/g,''):s}
 var groups=[].slice.call(document.querySelectorAll('.deli-group')),blocks=[].slice.call(box.querySelectorAll('.deli-toc-b'));
 var notes=[].map.call(document.querySelectorAll('.deli-card'),function(card){
  var group=card.closest('.deli-group'),link=box.querySelector('a[href="#'+card.id+'"]');
  return {card:card,row:link?link.parentNode:null,text:plain(card.textContent+' '+(group?group.getAttribute('data-find'):''))};
 });
 function showing(el){return !el.hidden}
 wrap.hidden=false;
 input.addEventListener('input',function(){
  var words=plain(input.value).split(/\s+/).filter(Boolean),shown=0;
  box.classList.toggle('is-finding',words.length>0);
  notes.forEach(function(n){
   var ok=words.every(function(w){return n.text.indexOf(w)>-1});
   n.card.hidden=!ok;if(n.row)n.row.hidden=!ok;if(ok)shown++;
  });
  groups.forEach(function(g){g.hidden=![].some.call(g.querySelectorAll('.deli-card'),showing)});
  blocks.forEach(function(b){b.hidden=![].some.call(b.querySelectorAll('li'),showing)});
  if(none)none.hidden=shown>0;
 });
})();
