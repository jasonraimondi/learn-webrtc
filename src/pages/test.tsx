import React from "react";
import Link from "next/link";

import Video from "../components/video";
import { useVideo } from "../hooks/use_video";

export default () => {
  const { stream, error } = useVideo();

  if (error) {
    return <h1>{error}</h1>;
  }

  if (!stream) {
    return <h1>no stream</h1>;
  }

  return <>
    <Video srcObject={stream} autoPlay={true}>HTML 5 not supported</Video>
    <Link href="/">
      <a>Home</a>
    </Link>
    <script src="https://webrtc.github.io/adapter/adapter-latest.js" />
  </>;
}
