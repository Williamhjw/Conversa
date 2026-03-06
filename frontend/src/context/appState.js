import chatContext from "./chatContext";
import { useState, useEffect } from "react";
import io from "socket.io-client";

const hostName = "http://localhost:5500"
// const hostName = "https://chat-app-u2cq.onrender.com";

// Socket is created with autoConnect: false so it doesn't attempt a
// connection before we have a JWT to include in the handshake auth.
// Call socket.connect() only after setting socket.auth.token.
var socket = io(hostName, {
  autoConnect: false,
  auth: { token: localStorage.getItem("token") || "" },
});

const ChatState = (props) => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("token") ? true : false
  );
  const [user, setUser] = useState(localStorage.getItem("user") || {});
  const [receiver, setReceiver] = useState({});
  const [messageList, setMessageList] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [myChatList, setMyChatList] = useState([]);
  const [originalChatList, setOriginalChatList] = useState([]);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch(`${hostName}/conversation/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "auth-token": localStorage.getItem("token"),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch data" + (await response.text()));
      }
      const jsonData = await response.json();
      setMyChatList(jsonData);
      setIsLoading(false);
      setOriginalChatList(jsonData);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    // The backend now includes { userId } in both events so the client can
    // identify which conversation partner changed status.
    socket.on("receiver-online", (data) => {
      setReceiver((prevReceiver) => ({ ...prevReceiver, isOnline: true }));
    });
  }, []);

  useEffect(() => {
    socket.on("receiver-offline", (data) => {
      setReceiver((prevReceiver) => ({
        ...prevReceiver,
        isOnline: false,
        lastSeen: new Date().toISOString(),
      }));
    });
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const res = await fetch(`${hostName}/auth/me`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "auth-token": token,
            },
          });
          const data = await res.json();
          setUser(data);
          console.log("user fetched");
          setIsAuthenticated(true);
          // Attach the token to the socket handshake then connect.
          // The backend JWT middleware will validate it before accepting the connection.
          socket.auth = { token };
          if (!socket.connected) socket.connect();
          socket.emit("setup");
        }
      } catch (error) {
        console.log(error);
        setIsAuthenticated(false);
        setUser({});
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    };

    fetchUser();
    fetchData();
  }, []);

  return (
    <chatContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        user,
        setUser,
        receiver,
        setReceiver,
        messageList,
        setMessageList,
        activeChatId,
        setActiveChatId,
        myChatList,
        setMyChatList,
        originalChatList,
        fetchData,
        hostName,
        socket,
        isOtherUserTyping,
        setIsOtherUserTyping,
        isChatLoading,
        setIsChatLoading,
        isLoading,
        setIsLoading,
      }}
    >
      {props.children}
    </chatContext.Provider>
  );
};

export default ChatState;
