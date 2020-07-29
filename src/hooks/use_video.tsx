import { useEffect, useState } from "react";

export const useVideo = () => {
  const [stream, setStream] = useState<MediaStream>();
  const [error, setError] = useState<string>();

  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection>();

  const [constraints, setConstraints] = useState<MediaStreamConstraints>({
    audio: true,
    video: true,
  });

  const getUserMedia = async () => {
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTracks = stream.getVideoTracks();
      console.log("Got stream with constraints:", constraints, videoTracks);
      console.log("Using video device: " + videoTracks[0].label);
      stream.onremovetrack = () => console.log("Stream ended");
      setStream(stream);
    } catch (error) {
      console.error(error);
      setError(error.message);
    }
  };

  useEffect(() => {
    getUserMedia().then(console.log);
    (window as any).pc = peerConnection;
  }, []);

  useEffect(() => {
    setPeerConnection(new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.stunprotocol.org" }],
    }));
  }, []);

  return { stream, error };
};


function createPeerConnection() {
  const myPeerConnection = new (window as any).RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.stunprotocol.org" }],
  });

  // myPeerConnection.onicecandidate = handleICECandidateEvent;
  // myPeerConnection.ontrack = handleTrackEvent;
  // myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
  // myPeerConnection.onremovetrack = handleRemoveTrackEvent;
  // myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
  // myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
  // myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
}
