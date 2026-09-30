window.MAP_IMAGES=window.MAP_IMAGES||{};
(function(){
  var d=window.MAP_IMAGES;
  function setAll(src){ d.desert=src; d.warehouse=src; d.ruins=src; }
  var img=new Image();
  img.onload=function(){ setAll(img.src); };
  img.src='assets/canyon.jpg';
})();
