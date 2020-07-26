// @ts-nocheck
import io from "socket.io-client";

let isMuted;
let videoIsPaused;
let dataChanel = null;
const browserName = getBrowserName();
const url = window.location.href;
const roomHash = url.substring(url.lastIndexOf("/") + 1).toLowerCase();
let mode = "camera";
// let isFullscreen = false;
let sendingCaptions = false;
let receivingCaptions = false;
const isWebRTCSupported =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia ||
  window.RTCPeerConnection;

// Element vars
// const chatInput = document.querySelector(".compose input");
// const remoteVideoVanilla = document.getElementById("remote-video");
// const remoteVideo = $("#remote-video");
// const captionText = $("#remote-video-text");
// const localVideoText = $("#local-video-text");
// const captionButtontext = $("#caption-button-text");
// const entireChat = $("#entire-chat");
// const chatZone = $("#chat-zone");

export const VideoChat = {
  connected: false,
  willInitiateCall: false,
  localICECandidates: [],
  socket: io(),
  remoteVideo: document.getElementById("remote-video"),
  localVideo: document.getElementById("local-video"),
  recognition: undefined,
  peerConnection: undefined,

  // Call to getUserMedia (provided by adapter.js for cross browser compatibility)
  // asking for access to both the video and audio streams. If the request is
  // accepted callback to the onMediaStream function, otherwise callback to the
  // noMediaStream function.
  requestMediaStream: function (event) {
    console.log("requestMediaStream");
    rePositionLocalVideo();
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        VideoChat.onMediaStream(stream);
        localVideoText.text("Drag Me");
        setTimeout(() => localVideoText.fadeOut(), 5000);
      })
      .catch((error) => {
        console.log(error);
        console.log(
          "Failed to get local webcam video, check webcam privacy settings"
        );
        // Keep trying to get user media
        setTimeout(VideoChat.requestMediaStream, 1000);
      });
  },

  // Called when a video stream is added to VideoChat
  onMediaStream: function (stream) {
    console.log("onMediaStream");
    VideoChat.localStream = stream;
    // Add the stream as video's srcObject.
    // Now that we have webcam video sorted, prompt user to share URL
    Snackbar.show({
      text: "Here is the join link for your call: " + url,
      actionText: "Copy Link",
      width: "750px",
      pos: "top-center",
      actionTextColor: "#616161",
      duration: 500000,
      backgroundColor: "#16171a",
      onActionClick: function (element) {
        // Copy url to clipboard, this is achieved by creating a temporary element,
        // adding the text we want to that element, selecting it, then deleting it
        var copyContent = window.location.href;
        $('<input id="some-element">')
          .val(copyContent)
          .appendTo("body")
          .select();
        document.execCommand("copy");
        var toRemove = document.querySelector("#some-element");
        toRemove.parentNode.removeChild(toRemove);
        Snackbar.close();
      },
    });
    VideoChat.localVideo.srcObject = stream;
    // Now we're ready to join the chat room.
    VideoChat.socket.emit("join", roomHash);
    // Add listeners to the websocket
    VideoChat.socket.on("full", chatRoomFull);
    VideoChat.socket.on("offer", VideoChat.onOffer);
    VideoChat.socket.on("ready", VideoChat.readyToCall);
    VideoChat.socket.on(
      "willInitiateCall",
      () => (VideoChat.willInitiateCall = true)
    );
  },

  // When we are ready to call, enable the Call button.
  readyToCall: function (event) {
    console.log("readyToCall");
    // First to join call will most likely initiate call
    if (VideoChat.willInitiateCall) {
      console.log("Initiating call");
      VideoChat.startCall();
    }
  },

  // Set up a callback to run when we have the ephemeral token to use Twilio's TURN server.
  startCall: function (event) {
    console.log("startCall >>> Sending token request...");
    VideoChat.socket.on("token", VideoChat.onToken(VideoChat.createOffer));
    VideoChat.socket.emit("token", roomHash);
  },

  // When we receive the ephemeral token back from the server.
  onToken: function (callback) {
    console.log("onToken");
    return function (token) {
      console.log("<<< Received token");
      // Set up a new RTCPeerConnection using the token's iceServers.
      VideoChat.peerConnection = new RTCPeerConnection({
        iceServers: token.iceServers,
      });
      // Add the local video stream to the peerConnection.
      VideoChat.localStream.getTracks().forEach(function (track) {
        VideoChat.peerConnection.addTrack(track, VideoChat.localStream);
      });
      // Add general purpose data channel to peer connection,
      // used for text chats, captions, and toggling sending captions
      dataChanel = VideoChat.peerConnection.createDataChannel("chat", {
        negotiated: true,
        // both peers must have same id
        id: 0,
      });
      // Called when dataChannel is successfully opened
      dataChanel.onopen = function (event) {
        console.log("dataChannel opened");
      };
      // Handle different dataChannel types
      dataChanel.onmessage = function (event) {
        const receivedData = event.data;
        // First 4 chars represent data type
        const dataType = receivedData.substring(0, 4);
        const cleanedMessage = receivedData.slice(4);
        if (dataType === "mes:") {
          handleRecieveMessage(cleanedMessage);
        } else if (dataType === "cap:") {
          recieveCaptions(cleanedMessage);
        } else if (dataType === "tog:") {
          toggleSendCaptions();
        }
      };
      // Set up callbacks for the connection generating iceCandidates or
      // receiving the remote media stream.
      VideoChat.peerConnection.onicecandidate = VideoChat.onIceCandidate;
      VideoChat.peerConnection.onaddstream = VideoChat.onAddStream;
      // Set up listeners on the socket
      VideoChat.socket.on("candidate", VideoChat.onCandidate);
      VideoChat.socket.on("answer", VideoChat.onAnswer);
      VideoChat.socket.on("requestToggleCaptions", () => toggleSendCaptions());
      VideoChat.socket.on("recieveCaptions", (captions) =>
        recieveCaptions(captions)
      );
      // Called when there is a change in connection state
      VideoChat.peerConnection.oniceconnectionstatechange = function (event) {
        switch (VideoChat.peerConnection.iceConnectionState) {
          case "connected":
            console.log("connected");
            // Once connected we no longer have a need for the signaling server, so disconnect
            VideoChat.socket.disconnect();
            break;
          case "disconnected":
            console.log("disconnected");
          case "failed":
            console.log("failed");
            // VideoChat.socket.connect
            // VideoChat.createOffer();
            // Refresh page if connection has failed
            location.reload();
            break;
          case "closed":
            console.log("closed");
            break;
        }
      };
      callback();
    };
  },

  // When the peerConnection generates an ice candidate, send it over the socket to the peer.
  onIceCandidate: function (event) {
    console.log("onIceCandidate");
    if (event.candidate) {
      console.log(
        `<<< Received local ICE candidate from STUN/TURN server (${event.candidate.address})`
      );
      if (VideoChat.connected) {
        console.log(`>>> Sending local ICE candidate (${event.candidate.address})`);
        VideoChat.socket.emit(
          "candidate",
          JSON.stringify(event.candidate),
          roomHash
        );
      } else {
        // If we are not 'connected' to the other peer, we are buffering the local ICE candidates.
        // This most likely is happening on the "caller" side.
        // The peer may not have created the RTCPeerConnection yet, so we are waiting for the 'answer'
        // to arrive. This will signal that the peer is ready to receive signaling.
        VideoChat.localICECandidates.push(event.candidate);
      }
    }
  },

  // When receiving a candidate over the socket, turn it back into a real
  // RTCIceCandidate and add it to the peerConnection.
  onCandidate: function (candidate) {
    // Update caption text
    captionText.text("Found other user... connecting");
    const rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
    console.log(
      `onCandidate <<< Received remote ICE candidate (${rtcCandidate.address} - ${rtcCandidate.relatedAddress})`
    );
    VideoChat.peerConnection.addIceCandidate(rtcCandidate);
  },

  // Create an offer that contains the media capabilities of the browser.
  createOffer: function () {
    console.log("createOffer >>> Creating offer...");
    VideoChat.peerConnection.createOffer(
      function (offer) {
        // If the offer is created successfully, set it as the local description
        // and send it over the socket connection to initiate the peerConnection
        // on the other side.
        VideoChat.peerConnection.setLocalDescription(offer);
        VideoChat.socket.emit("offer", JSON.stringify(offer), roomHash);
      },
      function (err) {
        console.log("failed offer creation");
        console.log(err, true);
      }
    );
  },

  // Create an answer with the media capabilities that both browsers share.
  // This function is called with the offer from the originating browser, which
  // needs to be parsed into an RTCSessionDescription and added as the remote
  // description to the peerConnection object. Then the answer is created in the
  // same manner as the offer and sent over the socket.
  createAnswer: function (offer) {
    console.log("createAnswer");
    return function () {
      console.log(">>> Creating answer...");
      rtcOffer = new RTCSessionDescription(JSON.parse(offer));
      VideoChat.peerConnection.setRemoteDescription(rtcOffer);
      VideoChat.peerConnection.createAnswer(
        function (answer) {
          VideoChat.peerConnection.setLocalDescription(answer);
          VideoChat.socket.emit("answer", JSON.stringify(answer), roomHash);
        },
        function (err) {
          console.log("Failed answer creation.");
          console.log(err, true);
        }
      );
    };
  },

  // When a browser receives an offer, set up a callback to be run when the
  // ephemeral token is returned from Twilio.
  onOffer: function (offer) {
    console.log("onOffer <<< Received offer");
    VideoChat.socket.on(
      "token",
      VideoChat.onToken(VideoChat.createAnswer(offer))
    );
    VideoChat.socket.emit("token", roomHash);
  },

  // When an answer is received, add it to the peerConnection as the remote description.
  onAnswer: function (answer) {
    console.log("onAnswer <<< Received answer");
    var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
    // Set remote description of RTCSession
    VideoChat.peerConnection.setRemoteDescription(rtcAnswer);
    // The caller now knows that the callee is ready to accept new ICE candidates, so sending the buffer over
    VideoChat.localICECandidates.forEach((candidate) => {
      console.log(`>>> Sending local ICE candidate (${candidate.address})`);
      // Send ice candidate over websocket
      VideoChat.socket.emit("candidate", JSON.stringify(candidate), roomHash);
    });
    // Reset the buffer of local ICE candidates. This is not really needed, but it's good practice
    VideoChat.localICECandidates = [];
  },

  // Called when a stream is added to the peer connection
  onAddStream: function (event) {
    console.log("onAddStream <<< Received new stream from remote. Adding it...");
    // Update remote video source
    VideoChat.remoteVideo.srcObject = event.stream;
    // Close the initial share url snackbar
    Snackbar.close();
    // Remove the loading gif from video
    VideoChat.remoteVideo.style.background = "none";
    // Update connection status
    VideoChat.connected = true;
    // Hide caption status text
    captionText.fadeOut();
    // Reposition local video after a second, as there is often a delay
    // between adding a stream and the height of the video div changing
    setTimeout(() => rePositionLocalVideo(), 500);
    // var timesRun = 0;
    // var interval = setInterval(function () {
    //   timesRun += 1;
    //   if (timesRun === 10) {
    //     clearInterval(interval);
    //   }
    //   rePositionLocalVideo();
    // }, 300);
  },
};

function getBrowserName() {
  var name = "Unknown";
  if (window.navigator.userAgent.indexOf("MSIE") !== -1) {
  } else if (window.navigator.userAgent.indexOf("Firefox") !== -1) {
    name = "Firefox";
  } else if (window.navigator.userAgent.indexOf("Opera") !== -1) {
    name = "Opera";
  } else if (window.navigator.userAgent.indexOf("Chrome") !== -1) {
    name = "Chrome";
  } else if (window.navigator.userAgent.indexOf("Safari") !== -1) {
    name = "Safari";
  }
  return name;
}
