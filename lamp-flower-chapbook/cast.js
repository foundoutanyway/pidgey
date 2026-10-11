// The cast on the page of films: a box opens a popup with that character's file. The same
// few lines as staff.js, with this page's own dialog and its own ids. Added 2026-10-10.
(function(){
 var d=document.getElementById('castDialog');if(!d||!d.showModal)return;
 var view=d.querySelector('.staff-view');
 [].slice.call(document.querySelectorAll('.cast-node')).forEach(function(b){
  b.addEventListener('click',function(){
   var body=document.getElementById('cast-'+b.getAttribute('data-key'));if(!body)return;
   view.innerHTML=body.innerHTML;if(!d.open)d.showModal();d.scrollTop=0;
  });
 });
 d.querySelector('.staff-close').addEventListener('click',function(){d.close()});
 d.addEventListener('click',function(e){if(e.target===d)d.close()});
})();
