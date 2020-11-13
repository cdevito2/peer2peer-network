# peer2peer-network

HOW TO USE:
- open 4 terminals, 1 for each 'P' folder(P1,P2,P3,P4)
- in P1, start the server. "node peer2peedDB.js -n 2"
-- the -n 2 determines the number of peers for this node. If more than 2 try to connect to this peer, they will be automatically redirected to another peer with available connections,
-- the peer will now log the timestamp it was created, and the ip address+port of its server. The peer also opens another port for iamge requests in the future. 

- in P2, start the peer and connect to p1. "-p 127.0.0.1:portNo -n #", where # is the number of connections you want to allow and the portNo is the port for P1 server. 
-- P2 creates another peer, and if it doesnt have max peers connected it will try and join any available peers. In this case its P1 because you entered P1's address.
-- P2 adds P1 as a known peer, then P2 adds P1 Server to its peerTable as pending first then attempts to connect by creating a new socket. 
-- P1 will check it it can still allow connections and will either decline or connect. If P2 is declined, P1 and P2 add eachother to their peerLists noting that the connection is refuesd. 

 *Note each peer is checking on an interval if they are at max connections or not. 


- in P3, start the peer with the same command as P2 as we also want to connect to P1. 
-- P3 starts a server and tries to connect with P1. P3 adds P1 to its peerList as pending and sends a connection request. 
-- P1 will receive the request and allow the connection if its not at max peers. 
-- assuming P3 is connected now, P1 sends its peer table(including P2) to P3
-- P3 now has peer2 in its peerList as pending. On an interval it will look through its peer list and if any peers are pending it will try to connect
-- If P1 and P2 have allowed enough peers to connect, P1 P2 and P3 should all be connected to eachnother.

- in P4, start the peer with the same command as P2 and P3, we want to try and connect to P1. Here i will explain what happens assuming P1 is already at max peers.
--  P4 stats server and tries to connect with P1. P3 adds P1 to peer table as pending and opens a socket to connect. Assuming P1 declines it will receive a declined request from P1
--  P1 and P4 both add eachother to their declinePeerTables. Note that P1 has also sent P4 its peer table which has P2 and P3.
--  P4 adds P2 and P3 to its peerlist with status pending. 
--  within an interval P4 checks its peer list to see if any are pending, if they are it will attempt to connect, going through logic previously mentioned above. 
