window.MAP_IMAGES=window.MAP_IMAGES||{};
window.MAP_IMAGES.keep="assets/maps/keep.svg";
window.MAP_IMAGES.warehouse="assets/maps/warehouse.svg";
window.MAP_IMAGES.canyon="assets/maps/canyon.svg";
window.MAP_IMAGES.ruins="assets/maps/ruins.svg";
window.MAP_IMAGES.forest="assets/maps/forest.svg";
window.MAP_IMAGES.docks="assets/maps/docks.svg";
window.MAP_IMAGES.ice="assets/maps/ice.svg";
(function(){
  const ground={x:0,y:1020,w:1920,h:60};
  const plats=[
    ground,
    {x:400,y:880,w:280,h:22},{x:1240,y:880,w:280,h:22},
    {x:620,y:760,w:680,h:22},
    {x:430,y:640,w:260,h:20},{x:1230,y:640,w:260,h:20},
    {x:760,y:520,w:400,h:20},
    {x:450,y:400,w:220,h:18},{x:1250,y:400,w:220,h:18},
    {x:820,y:280,w:280,h:16}
  ];
  const walls=plats.concat([
    {x:360,y:420,w:36,h:600},{x:1524,y:420,w:36,h:600},{x:942,y:520,w:36,h:500}
  ]);
  const spawns=[{x:480,y:860},{x:1440,y:860},{x:960,y:740},{x:520,y:620},{x:1400,y:620},{x:960,y:500}];
  const pack={plats,walls,spawns};
  window.MAP_PACK={ keep:pack, warehouse:pack, canyon:pack, ruins:pack, forest:pack, docks:pack, ice:pack };
})();
