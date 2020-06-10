/* USED OUDA ASSIGNMENT 2 SOLUTION AS FRAMEWORK THEN BUILT UPON IT*/

let net = require('net'),
    cPTPpacket = require('./cPTPmessage'),
   singleton = require('./Singleton');
    ITPpacket = require('./ITPpacketResponse')
const fs = require('fs');

let peerTable = {},
    peerList = {},
    
    isFull = {},
    nickNames = {},
    clientIP = {},
    startTimestamp = {};

let busy = false; //boolean flag to determine if server is already handling another client request



module.exports = {
    
    handlePeerJoining: handlePeerJoining,
    handleConnect: handleConnect,
    handleClientJoining : handleClientJoining
    //handleSearch: handleSearch,

};

function handleClientJoining(sock,peerTable,maxPeers,sender,searchHistory,imgPackets)
{
    assignClientName(sock,nickNames);
    const chunks =[];
    sock.on('data',function(data){
        let version = bytes2number(data.slice(0,3));
        let reqType = bytes2number(data.slice(3,4));
        let imageFilename = bytes2string(data.slice(4));
       
        if (reqType == 0) //its a query
        {
            
          console.log('\n' + nickNames[sock.id] + ' requests:' + '\n    --ITP version: ' + version
                + '\n    --Request type: ' + reqType
                 + '\n    --Image file name: \'' + imageFilename +'\'\n');

        //now search for file
        fs.readFile('images/' + imageFilename, (err, data) => { //search local image folder
            //taken from ouda assignment 1 solution clientHandler.js
            if (!err) {
                var infile = fs.createReadStream('images/' + imageFilename);
                const imageChunks = [];
                infile.on('data', function (chunk) {
                    imageChunks.push(chunk);
                });
    
                infile.on('close', function () {
                    let image = Buffer.concat(imageChunks);
                    ITPpacket.init(1, singleton.getSequenceNumber(), singleton.getTimestamp(), image, image.length);
                    sock.write(ITPpacket.getPacket());
                    sock.end();
                     
                });
            } 
            else { //have to search peer network as it is not in local directory
                
                if (!(busy)) //check if aleady searching in p2p network
                {
                    imgPackets.length = 0;
                    console.log('image not found, searching p2p network');
                    busy = true;
                    //enter search code here
                    let originalHost = sock.localAddress;
                    let originalPort = sock.localPort;
                    
                    let originAddr = {'origin':{'port':originalPort,'IP':originalHost}}
                    
                    //this is the imageDB  server socket information
                    //search packet must contain this info
                    let searchID = sock.remotePort;
                    let searchHistoryKey = searchID+':'+imageFilename;
                    //ensure circular check of recent searches with array of max length n
                    if(searchHistory >= maxPeers)
                    {
                        searchHistory.shift();//function which removes zero indexed element
                    }
                    searchHistory.push(searchHistoryKey);//add latest search to the array
                    //create packet to send through network with msgType 3 to indicate search
                    //sender = peerLocation, originAddr = imageserver info
                    cPTPpacket.init(3,sender,originAddr,searchID,imageFilename);
                    //get packet
                    let packetSearch = cPTPpacket.getPacket();
                    //send to each peer in peer table if status is peered
                    Object.values(peerTable).forEach(peer => {
                        //check if status pending or not and ensure not sending to original peer
                        if (peer.status == 'peered' )
                        {
                            let newSock = new net.Socket();
                            newSock.connect(peer.port, peer.IP, function () {
                                newSock.write(packetSearch); //write packet to the server 
                                newSock.end();
                        });
                        // Handling error when peer is NOT available.
                        newSock.on('error', function () {
                            newSock.log('Peer', peer.IP + ':' + peer.port, 'is NOT available!');
                            newSock.end();
                        });
                        }
                        
                    }); //end loop through peer table

                    
                    dontSendDuplicates(imgPackets,imageFilename,sock) //call function to send image to packet
    
                }
                else{ //server is busy, send packet 
                    console.log('server is busy')
                    //send busy response
                    ITPpacket.init(3,singleton.getSequenceNumber(),singleton.getTimestamp(),[],0)
                    sock.write(ITPpacket.getPacket())
                    sock.end() //end connection
                }
                
            }
        });
         //end if server is not busy
        } //end if reqType==0
        if(reqType == 1){ //file found
            imgPackets.push(data);//add to the array of copied found
        }

    }) //end on sock data
    sock.on('close', function () {
        handleClientLeaving(sock);
    });
}
function dontSendDuplicates(imgPackets,imageFilename,sock)
{
    let interval = setInterval(function () {
        //send packet to client with image
        if (imgPackets.length > 0) { 
            console.log('Sending ' + imageFilename + ' to ' + nickNames[sock.id]);
            sock.write(imgPackets[0]); //this line here ensures that we are not sendihg a duplicate
            sock.end();
            busy = false; //server is done and no longer busy
            clearInterval(interval); //stop the interval as we have sent the image
        } 
        
       
    }, 1); //frequency of calling the function
}

                    


function handleClientLeaving(sock) {
    console.log(nickNames[sock.id] + ' closed the connection');
    busy = false;
}

function assignClientName(sock, nickNames) {
    sock.id = sock.remoteAddress + ':' + sock.remotePort;
    startTimestamp[sock.id] = singleton.getTimestamp();
    var name = 'Client-' + startTimestamp[sock.id];
    nickNames[sock.id] = name;
    clientIP[sock.id] = sock.remoteAddress;
}

// Handling PEER server connections
function handlePeerJoining (sock, maxPeers, sender, peerTable,  searchHistory,declinedPeerTable) {
    sock.on('data', (message) => {
        // Data is <ip_address>:<port>
        var pattern = /^\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d+$/;
        
        // If new Peer is trying to get peer2peer connection.
        if (bytes2string(message).match( pattern )) { 
            let peersCount = Object.keys(peerTable).length; //get number of peers
            let addressSent = bytes2string(message).split(':'); //clientPeer sent its address to serverPeer
            let peer = {'port': addressSent[1], 'IP': addressSent[0]};
            
            if (peersCount === maxPeers)  //if peerTable full decline peer
                declineClient(sock, sender, peerTable, declinedPeerTable,peer);
            else 
                handleClient(sock, sender, peer, peerTable) //if peer table not full accept client
        }
        
        
        else {
            let msgType = bytes2number(message.slice(3, 4));
            if (msgType == 3) { //recieiving query packet for an image
                let sender = bytes2string(message.slice(4, 8)); //reading in data
                let searchID = bytes2number(message.slice(8, 12));
                let portOrigin = bytes2number(message.slice(14, 16));
                let ipOrigin = bytes2number(message.slice(16, 17)) + '.'
                    + bytes2number(message.slice(17, 18)) + '.'
                    + bytes2number(message.slice(18, 19)) + '.'
                    + bytes2number(message.slice(19, 20));
                let imageFilename = bytes2string(message.slice(20));
                
                let searchHistoryKey = searchID + ':' + imageFilename; //recreating original searchKey from above

                // If P2Psearch not in recent search history... else discard packet
                if (searchHistory.indexOf(searchHistoryKey) < 0) { //will return val < 0 if search key is not in history
                    // Update search history
                    if(searchHistory.length >= maxPeers){
                        searchHistory.shift();
                    } //same as code above, ensuring circular check of n peers
                        
                    searchHistory.push(searchHistoryKey);// add search to last spot in history array as it is most recent

                    // Search file locally.
                    fs.readFile('images/' + imageFilename, (err, data) => {
                        if (!err) { // if image found
                            console.log('\n', imageFilename, 'image found sending to ' + ipOrigin + ':' + portOrigin);
                            //send image packet
                            //will need to create new socket to send it then end socket
                            let imageFoundSocket = new net.Socket();
                            //connect to origin port + ip
                            imageFoundSocket.connect(portOrigin,ipOrigin,function()
                            {
                                let infile = fs.createReadStream('images/'+imageFilename);//read in picture data
                                const imgChunks = [];
                                infile.on('data',function(chunk){
                                    imgChunks.push(chunk);
                                })
                                infile.on('close',function(){
                                    //create ITP packet and send
                                    //msg = 1 for found
                                    let imageData = Buffer.concat(imgChunks)
                                    ITPpacket.init(1,singleton.getSequenceNumber,singleton.getTimestamp(),Buffer.concat(imgChunks),imageData.length);
                                    let foundImagePacket = ITPpacket.getPacket(); //get packet
                                    imageFoundSocket.write(foundImagePacket); //send back to original peer requesting
                                    //now we have to end connection
                                    imageFoundSocket.end();
                                })
                            })

                        } else { // not found, flood to connected peers
                            console.log('\n', imageFilename, 'not found! Searching in P2P network...');
                            
                            
                            //same code as previous
                            //loop through peer table and send to all peers is status is not pending
                            //and also dont send to original peer who requested
                            let originAddr = {'origin':{'port': portOrigin, 'IP': ipOrigin}};
                            
                            cPTPpacket.init(3,sender,originAddr,searchID,imageFilename);
                    //get packet
                            let packetSearch = cPTPpacket.getPacket();
                    //send to each peer in peer table if status is peered
                            Object.values(peerTable).forEach(peer => {
                        //check if status pending or not and ensure not sending to original peer
                             if (peer.status == 'peered' )
                            {
                                let newSock = new net.Socket();
                                newSock.connect(peer.port, peer.IP, function () {
                                    newSock.write(packetSearch); //write packet to the server 
                                    newSock.end();
                             });
                            // Handling error when peer is NOT available.
                            newSock.on('error', function () {
                                newSock.log('Peer', peer.IP + ':' + peer.port, 'is NOT available!');
                                newSock.end();
                            });
                            }
                        
                            }); //end loop through peer ta
                        }//end else 
                    });//end of readfile
                }//end of searchHistory <0
                else
                {
                    //its in recent search history so discard query
                    //do nothing here
                }
            }
            else
            {
                //msg type is not 3, so we arent searching-- nothing to do here
            }
        }
    });
}//end fcn



// Handling Peer Connections
function handleConnect (knownPeer, localPeer, maxPeers, peerLocation, peerTable, declinedPeerTable) {
        
    // add the server (the receiver request) into the table as pending
    let pendingPeer = {'port': knownPeer.port, 'IP': knownPeer.IP, 'status': 'pending'};
    let peerAddress = pendingPeer.IP + ':' + pendingPeer.port;
    peerTable[peerAddress] = pendingPeer;

    // Trying to connect to the known peer address
    let clientPeer = new net.Socket();
    clientPeer.connect(knownPeer.port, knownPeer.IP, function () {
        handleCommunication(clientPeer, maxPeers, peerLocation, peerTable, localPeer,declinedPeerTable);
        clientPeer.write(localPeer.IP + ':' + localPeer.port);
    });
    // Handling error when peer is not Available
    clientPeer.on('error', function () {
        declinedPeerTable[peerAddress] = {'port': knownPeer.port, 'IP': knownPeer.IP, 'status': 'error'};
        delete peerTable[peerAddress];
    });
}

// Handle Peer Communications
function handleCommunication (client, maxPeers, location, peerTable, localPeer,declinedPeerTable) {
    // get message from server
    
    client.on('data', (message) => {
        let version = bytes2number(message.slice(0, 3));
        let msgType = bytes2number(message.slice(3, 4));
        let sender = bytes2string(message.slice(4, 8));
        let numberOfPeers = bytes2number(message.slice(8, 12));
        let peerList = {};

        // Get list of known peers of connected peer
        for (var i = 0; i < numberOfPeers; i++) {
            let peerPort = bytes2number(message.slice(14 + i*8, 16 + i*8));
            let peerIP = bytes2number(message.slice(16 + i*8, 17 + i*8)) + '.'
                + bytes2number(message.slice(17 + i*8, 18 + i*8)) + '.'
                + bytes2number(message.slice(18 + i*8, 19 + i*8)) + '.'
                + bytes2number(message.slice(19 + i*8, 20 + i*8));
            let joiningPeer = {'port': peerPort, 'IP': peerIP};
            let peerAddress = peerIP + ':' + peerPort;
            if(peerPort != localPeer.port  && !(peerPort in peerTable))
            {
            peerList[peerAddress] = {'port': peerPort, 'IP': peerIP, 'status': 'pending'}
            }
            
        }
        
        // IF is a Welcome message
        if (msgType == 1) {
            isFull[client.remotePort] = false;
            console.log("\nConnected to peer " + sender + ":" + client.remotePort + " at timestamp: " + singleton.getTimestamp());

            // add the server into peer table
            let receiverPeer = {'port': client.remotePort, 'IP': client.remoteAddress};
            let peerAddress = receiverPeer.IP + ':' + receiverPeer.port;
            peerTable[peerAddress] = {'port': client.remotePort, 'IP': client.remoteAddress, 'status': 'peered'}
            console.log("Received ack from " + sender + ":" + client.remotePort);
            
            Object.values(peerList).forEach(peer => {
                let peerAddress = peer.IP + ':' + peer.port;
                
                if(peer.port != client.localPort && !(peerAddress == Object.keys(peerTable)[0])){
                    let peerAddress = peer.IP + ':' + peer.port;
                    
                    console.log("  which is peered with: " + peer.IP + ":" + peer.port);
                
                    peerTable[peerAddress] = {'port': peer.port, 'IP': peer.IP, 'status': 'pending'}
                }
            });
        } else { // IF is a DECLINED message
            console.log("Received ack from " + sender + ":" + client.remotePort);
            isFull[client.remotePort] = true;
            Object.values(peerList).forEach(peer => {
                let peerAddress = peer.IP + ':' + peer.port;
                if(peer.port != client.remotePort && !(peerAddress == Object.keys(peerTable)[0]))
                {
                console.log("  which is peered with: " + peer.IP + ":" + peer.port);
                let peerAddress = peer.IP + ':' + peer.port;
                peerTable[peerAddress] = {'port': peer.port, 'IP': peer.IP, 'status': 'pending'}
                }
            });
            console.log("Join redirected, try to connect to the peer above.");
            
            // remove the server (the receiver request) from the peerTable, and status 'Declined' in unpeerTable
            let peerAddress = client.remoteAddress + ':' + client.remotePort;
            delete peerTable[peerAddress];
            declinedPeerTable[peerAddress] = {'port': client.remotePort, 'IP': client.remoteAddress, 'status': 'declined'}
            
        }
    }); 
}

// Handle Accepting client, sending a welcome message
function handleClient(sock, sender, peer, peerTable) {
    // accept client request
    addClient(peer, peerTable);

    // send acknowledgment to the client
    cPTPpacket.init(1, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

// Decline peer connection, sending decline message
function declineClient(sock, sender, peerTable, declinedPeerTable,peer) {
    
    let peerAddress = peer.IP + ':'+ peer.port;
    declinedPeerTable[peerAddress] = {'port': peer.port, 'IP': peer.IP};
    console.log('\nPeer table full: ' + peerAddress + ' redirected');

    // send acknowledgment to the client
    cPTPpacket.init(2, sender, peerTable);
    sock.write(cPTPpacket.getPacket());
    sock.end();
}

function addClient(peer, peerTable) {
    let peerAddress = peer.IP + ':' + peer.port;
    peerTable[peerAddress] = {'port': peer.port, 'IP': peer.IP, 'status': 'peered'}
    console.log('\nConnected from peer ' + peerAddress);
}

function bytes2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        if (array[i] > 0)
            result += (String.fromCharCode(array[i]));
    }
    return result;
}

function bytes2number(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result ^= array[array.length - i - 1] << 8 * i;
    }
    return result;
}