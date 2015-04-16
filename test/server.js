var Chunk = require('../index.js');
var mc = require('minecraft-protocol');

var world = new Chunk();

for(var x=0; x<16; x++)
    for(var z=0; z<16; z++)
        world.setBlockType(x, 0, z, 2);


var server = mc.createServer({ 'online-mode': false });

server.on('login', function(client) {
client.write('login', {
    entityId: client.id,
    levelType: 'default',
    gameMode: 1,
    dimension: 0,
    difficulty: 2,
    maxPlayers: server.maxPlayers,
    reducedDebugInfo: false
  });

  client.write('position', {
    x: 0,
    y: 5.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });

  var msg = {
    translate: 'chat.type.announcement',
    "with": [
      'Server',
      'Hello, world!'
    ]
  };
  client.write('chat', { message: JSON.stringify(msg), position: 0 });

  var x = 0;
  var z = 0;
  setInterval(function() {
     // console.log(x, z);
      if(z == 16) {
          return;
      }
      if(x >= 16) {
          x = 0;
          z++;
      }

      world.setBlockLight(x, 1, z, 15);
      world.setBlockType(x, 0, z, 1);

      x++;

      client.write('map_chunk', {
          x: 0,
          z: 0,
          groundUp: true,
          bitMap: 0xFFFF,
          chunkData: world.dump()
      });
  }, 1000);


});
