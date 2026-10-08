/* The section above the Notice Wall. A notice named under a card opens that notice whole,
   the same as selecting its poster. Without this script the link still jumps to the poster. */
(function(){
 document.addEventListener('click',function(e){
  var link=e.target.closest?e.target.closest('a[data-open]'):null;
  if(!link)return;
  var poster=document.getElementById(link.getAttribute('data-open'));
  var open=poster?poster.querySelector('.psa-open'):null;
  if(!open)return;
  e.preventDefault();
  poster.scrollIntoView({block:'center'});
  open.click();
 });
})();
