import { useEffect, useState } from "react";

export const useVideo = () => {
  const [stream, setStream] = useState<MediaStream>();
  const [error, setError] = useState<string>();

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
    } catch(error) {
      console.error(error)
      setError(error.message)
    }
  };

  useEffect(() => {
    getUserMedia().then(console.log);
  }, []);

  return { stream, error };
};
