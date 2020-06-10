let net = require('net'),
    singleton = require('./Singleton'),
    handler = require('./PeersHandler');

singleton.init();

let os = require('os');
let ifaces = os.networkInterfaces();
let HOST = '';
let PORT = singleton.getPort(); //get random PEER port 

let maxpeers = 6; // Default Max number of Peers
let ITPVersion = '3314'; 



// get the loaclhost ip address
Object.keys(ifaces).forEach(function (ifname) {
    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' == iface.family && iface.internal !== false) {
            HOST = iface.address;
        }
    });
});

// get current folder name
//let path = __dirname.split("\\");
let path = __dirname.split("\\");
let peerLocation = path[path.length - 1];

// Address Objects
let localPeer = {'port': PORT, 'IP': HOST};
//let imageAddress = {'port': IMAGE_PORT, 'IP': HOST};
let knownPeer = {};
let SearchHistory = []; //will be used to store search history
// run as a PEER server
let serverPeer = net.createServer();
serverPeer.listen(PORT, HOST);
console.log('This peer address is ' +  HOST + ':' + PORT +  ' located at ' + peerLocation);

// initialize peer and known peers tables
let peerTable = {};
let declinedPeerTable = {};
serverPeer.on('connection', function (sock) {
    // received PEER connection request
    handler.handlePeerJoining(sock, maxpeers, peerLocation, peerTable,  SearchHistory, declinedPeerTable);
});


if (process.argv.length > 2) {
    // call as node peer [-p <serverIP>:<port> -n <maxpeers> -v <version>]
    
   
   if (process.argv[2] === '-p' && process.argv[4] === '-n' && process.argv[6] === '-v') //user has entered server+port 
   {
       
       if(parseInt(process.argv[5]) <= 0 || parseInt(process.argv[7]) != 3314)
       {
           console.log('incorrect info need version 3314 and max peers >= 1')
       }
       else{
           maxpeers = parseInt(process.argv[5]);
        knownPeer = {'port': parseInt(process.argv[3].split(':')[1]), 'IP': process.argv[3].split(':')[0]};
       }
      
    }

   if(process.argv[2] === '-p' && process.argv[4] === '-n' && process.argv[6] !== '-v')
   {
       
       //use default version
       if(parseInt(process.argv[5]) <= 0)
       {
           console.log('use a different maxpeers')
       }
       else{
           maxpeers = parseInt(process.argv[5]);
           knownPeer = {'port': parseInt(process.argv[3].split(':')[1]), 'IP': process.argv[3].split(':')[0]};
       }
   }
    
   if(process.argv[2] === '-p' && process.argv[4] !== '-n' && process.argv[6] !== '-v')
   {
        knownPeer = {'port': parseInt(process.argv[3].split(':')[1]), 'IP': process.argv[3].split(':')[0]};
   }

   if(process.argv[2] === '-n') //its a server setting its max peers
   {
    if(parseInt(process.argv[3]) <= 0)
    {
        console.log('use a different maxpeers')
        //serverPeer.close();
    }
    else{
        maxpeers = parseInt(process.argv[3]) //maxpeers for the server peer
    }
   }
  
    if (knownPeer.IP) //connect to peer from process.argv arguments
    {
        
        handler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable, declinedPeerTable);
    }
}

// Automatic Join
let totalConnected =0;
setInterval(function() {
    
    Object.values(peerTable).forEach(peer => { //check if we already have max connections
        let peerAddress = peer.IP+':'+peer.port;
        if ((peer.status == 'peered') &&  !(peerAddress in declinedPeerTable)) //check if peer not in declined peer table
            totalConnected++; //count total peers in which you are actually peered with
    });

    if (totalConnected < maxpeers) { //we have not connected to the max number of peers yet
        knownPeer = {};
            
       
        Object.values(peerTable).forEach(peer => {
            let peerAddress = peer.IP+':'+peer.port;
            if ((peer.status == 'pending') && !knownPeer.IP && !(peerAddress in declinedPeerTable))
            {
                knownPeer = peer; //set peer to connect to , only if its not in declined table and the status is still pending
            }
        });
     
    if (knownPeer.IP) //if its not null/undefined connect
            handler.handleConnect(knownPeer, localPeer, maxpeers, peerLocation, peerTable, declinedPeerTable);
    }
}, 1000);


// start peer2peerdb image server
let peer2peerDB = net.createServer();
let IMAGE_PORT = singleton.getPort(); //get image port

peer2peerDB.listen(IMAGE_PORT,HOST);

console.log('peer2peerDB SERVER is started at '+singleton.getTimestamp()+' and is listening on '+HOST+':'+IMAGE_PORT);


let imgPackets = []; //will be used if a peer finds the image
peer2peerDB.on('connection',function(sock)
{
    //handle image joining or handle client joining
    handler.handleClientJoining(sock,peerTable,maxpeers,peerLocation,SearchHistory,imgPackets)
})