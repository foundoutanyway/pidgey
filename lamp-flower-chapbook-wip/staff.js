(function(){
 var d=document.getElementById('staffDialog');if(!d||!d.showModal)return;
 var view=d.querySelector('.staff-view');
 [].slice.call(document.querySelectorAll('.staff-node')).forEach(function(b){
  b.addEventListener('click',function(){
   var body=document.getElementById('staff-'+b.getAttribute('data-key'));if(!body)return;
   view.innerHTML=body.innerHTML;if(!d.open)d.showModal();d.scrollTop=0;
  });
 });
 d.querySelector('.staff-close').addEventListener('click',function(){d.close()});
 d.addEventListener('click',function(e){if(e.target===d)d.close()});
})();
