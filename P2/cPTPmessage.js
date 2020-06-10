//size of the response packet header:
let HEADER_SIZE = 12;

//Fields that compose the header
let version,
    messageType;

module.exports = {
    message: '', //Bitstream of the cPTP header
    headerSize: 0,
    payloadSize: 0, //size of the ITP payload
    payload: '', //Bitstream of the ITP payload

    init: function(msgType, sender, peerTable, searchID = 0, imageFileName = '') {
        let noOfPeers = Object.keys(peerTable).length;
        
        //fill by default header fields:
        version = 3314;

        //fill changing header fields:
        messageType = msgType;

        //build the header bistream:
        //--------------------------
        this.headerSize = HEADER_SIZE + 8 * noOfPeers;
        this.message = new Buffer.alloc(this.headerSize);

        //fill the header array of bytes
        // first 4 bytes
        let v1 = version << 8;
        this.message[0] = (v1 >>> (24)) ;
        let v2 = version << 16;
        this.message[1] = (v2 >>> (24));
        let v3 = version << 24;
        this.message[2] = (v3 >>> (24));

        this.message[3] = (messageType);
        //second 4 bytes
        let senderBytes = stringToBytes(sender); // should be within 4 bytes
        for (var i = 4; i < 8; i++) {
            this.message[i] = senderBytes[i - 4] || '';
        }
        
        noOfPeers = searchID || Object.keys(peerTable).length;
        // third 4 bytes
        let n1 = noOfPeers ;
        this.message[8] = (n1 >>> 24) ;
        let n2 = noOfPeers << 8;
        this.message[9] = (n2 >>> 24);
        let n3 = noOfPeers << 16;
        this.message[10] = (n3 >>> 24) ;
        let n4 = noOfPeers << 24;
        this.message[11] = (n4 >>> 24);

        let z = 0;
        
        Object.values(peerTable).forEach(peer => { //loop through each peer and add to buffer
           // console.log(peer)
           
            let port = peer.port;
            let IP = peer.IP.split('.');
        // fourth 4 bytes
            // 2 bytes reserved
            this.message[12 + z*8] ='' ; //each peer takes minimum 8 bits so we multiple by factor of 8 to accomodate
            this.message[13 + z*8] ='' ;
            // 2 bytes peer port
            let p1 = port << 16;
            this.message[14 + z*8] = (p1 >>> 24) ;
            let p2 = port << 24;
            this.message[15 + z*8] = (p2 >>> 24);

        // fifth 4 bytes
            this.message[16 + z*8] = IP[0];
            this.message[17 + z*8] = IP[1];
            this.message[18 + z*8] = IP[2];
            this.message[19 + z*8] = IP[3];

            z++; //this is used to get the multiple of 8 to ensure all peers are sent in message
        });

        let ifname = stringToBytes(imageFileName);

        this.payloadSize = ifname.length;
        this.payload = new Buffer.alloc(ifname.length);

        for (var Ni = 0; Ni < ifname.length; Ni++)
            this.payload[Ni] = ifname[Ni] ;
    },

    //--------------------------
    //getpacket: returns the entire packet
    //--------------------------
    getPacket: function() {
        let packet = new Buffer.alloc(this.payloadSize + this.headerSize);
        //construct the packet = header + payload
        for (var Hi = 0; Hi < this.headerSize; Hi++)
            packet[Hi] = this.message[Hi];
        for (var Pi = 0; Pi < this.payloadSize; Pi++)
            packet[Pi + this.headerSize] = this.payload[Pi];

        return packet;
    }
};

function stringToBytes(str) {
    var ch, st, re = [];
    for (var i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);  // get char
        st = [];                 // set up "stack"
        do {
            st.push( ch & 0xFF );  // push byte to stack
            ch = ch >>> 8;          // shift value down by 1 byte
        }
        while ( ch );
        // add stack contents to result
        // done because chars have "wrong" endianness
        re = re.concat( st.reverse() );
    }
    // return an array of bytes
    return re;
}
