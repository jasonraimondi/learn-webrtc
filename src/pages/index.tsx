import Head from "next/head";
import { useEffect } from "react";
import io from "socket.io-client";
import Video from "../components/video";
import Link from "next/link";

export default () => {
  useEffect(() => {
    fetch("/api/socketio").finally(() => {
      const socket = io();

      socket.on("connect", () => {
        console.log("connect");
        socket.emit("hello");
      });

      socket.on("hello", data => {
        console.log("hello", data);
      });

      socket.on("a user connected", () => {
        console.log("a user connected");
      });

      socket.on("disconnect", () => {
        console.log("disconnect");
      });
    });
  }, []);

  return <div>
    <Head>
      <title>Create Next App</title>
      <link rel="icon" href="/favicon.ico"/>
    </Head>
    <h1>Socket.io</h1>
    <Link href="/test">
      <a>Test</a>
    </Link>
  </div>;
}
