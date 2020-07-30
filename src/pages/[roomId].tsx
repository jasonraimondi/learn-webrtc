import Head from "next/head";
import { useEffect, useState } from "react";
import io from "socket.io-client";
import Link from "next/link";
import Video from "../components/video";

const useSocket = (roomId: string) => {
  const SIGNALING_SERVER_URL = 'http://localhost:9999';

  const [socket, setSocket] = useState<SocketIOClient.Socket>();
  const [pc, setPC] = useState<RTCPeerConnection>();
  const [localStream, setLocalStream] = useState<any>();
  const [remoteStream, setRemoteStream] = useState<any>();

  useEffect(() => {
    fetch("/api/socketio").finally(() => {
      const _socket = io(SIGNALING_SERVER_URL);

      getLocalStream()
      bootstrapSocket(_socket);
      _socket.emit("join room", roomId);
      setSocket(_socket);
    });
  }, []);

  const bootstrapSocket = (_socket: SocketIOClient.Socket) => {
    _socket.on('data', (data) => {
      console.log('Data received: ',data);
      handleSignalingData(data);
    });

    _socket.on('ready', () => {
      console.log('Ready');
      // Connection with signaling server is ready, and so is local stream
      createPeerConnection();
      sendOffer();
    });

  }
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      console.log('Stream found');
      setLocalStream(stream);
      // Connect after making sure that local stream is availble
      socket.connect();
    } catch (error) {
      console.error('Stream not found: ', error);
    }
  }

  // WebRTC config: you don't have to change this for the example to work
  // If you are testing on localhost, you can just use PC_CONFIG = {}
  const PC_CONFIG = {};

  const createPeerConnection = () => {
    try {
      const peer = new RTCPeerConnection(PC_CONFIG);
      peer.onicecandidate = onIceCandidate;
      // @ts-ignore
      peer.onaddstream = onAddStream;
      // @ts-ignore
      peer.addStream(localStream);
      setPC(peer);
      console.log('PeerConnection created');
    } catch (error) {
      console.error('PeerConnection failed: ', error);
    }
  };

  const sendOffer = () => {
    console.log('Send offer');
    pc.createOffer().then(
      setAndSendLocalDescription,
      (error) => { console.error('Send offer failed: ', error); }
    );
  };

  const sendAnswer = () => {
    console.log('Send answer');
    pc.createAnswer().then(
      setAndSendLocalDescription,
      (error) => { console.error('Send answer failed: ', error); }
    );
  };

  const sendData = (data) => {
    socket.emit('data', data);
  };

  const setAndSendLocalDescription = (sessionDescription) => {
    pc.setLocalDescription(sessionDescription);
    console.log('Local description set');
    sendData(sessionDescription);
  };

  const onIceCandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate');
      sendData({
        type: 'candidate',
        candidate: event.candidate
      });
    }
  };

  const onAddStream = (event) => {
    console.log('Add stream');
    setRemoteStream(event.stream);
  };

  const handleSignalingData = (data) => {
    switch (data.type) {
      case 'offer':
        createPeerConnection();
        pc.setRemoteDescription(new RTCSessionDescription(data));
        sendAnswer();
        break;
      case 'answer':
        pc.setRemoteDescription(new RTCSessionDescription(data));
        break;
      case 'candidate':
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        break;
    }
  };
  return {
    socket,
    localStream,
    remoteStream
  }
}

export default () => {
  const { socket, localStream, remoteStream } = useSocket("randomRoom");

  return <div>
    <Head>
      <title>Create Next App</title>
    </Head>
    <div>
      <Video srcObject={localStream} autoPlay={true} />
      <p>Local Stream</p>
    </div>
    <div>
      <Video srcObject={remoteStream} autoPlay={true} />
      <p>Remote Stream</p>
    </div>
    <button onClick={() => socket.emit("chat message", "something")}>Send Message</button>
    <Link href="/test">
      <a>Test</a>
    </Link>
  </div>;
}
