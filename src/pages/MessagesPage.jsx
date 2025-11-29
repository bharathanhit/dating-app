import { useEffect, useState, useRef } from "react";
import { ref, onValue, set, serverTimestamp, update, push } from "firebase/database";
import { realtimeDb } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const MessagesPage = ({ activeConv, receiver }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [theirTyping, setTheirTyping] = useState(false);
  const [status, setStatus] = useState(null);
  const msgRef = useRef();

  // ----------------------------
  // 1️⃣ LISTEN TO ONLINE STATUS
  // ----------------------------

  useEffect(() => {
    if (!receiver?.uid) return;

    const statusRef = ref(realtimeDb, `status/${receiver.uid}`);
    return onValue(statusRef, snap => {
      setStatus(snap.val());
    });
  }, [receiver]);

  // ----------------------------
  // 2️⃣ SEND ONLINE / LAST SEEN
  // ----------------------------

  useEffect(() => {
    if (!user?.uid) return;

    const myStatusRef = ref(realtimeDb, `status/${user.uid}`);

    // online now
    set(myStatusRef, {
      online: true,
      lastSeen: serverTimestamp(),
    });

    // on tab close → offline
    const handleOffline = () => {
      update(myStatusRef, {
        online: false,
        lastSeen: serverTimestamp(),
      });
    };

    window.addEventListener("beforeunload", handleOffline);

    return () => {
      handleOffline();
      window.removeEventListener("beforeunload", handleOffline);
    };
  }, [user]);

  // ----------------------------
  // 3️⃣ GET MESSAGES
  // ----------------------------

  useEffect(() => {
    if (!activeConv?.id) return;

    const msgsRef = ref(realtimeDb, `messages/${activeConv.id}`);
    return onValue(msgsRef, snap => {
      const data = snap.val() || {};
      const arr = Object.keys(data).map(id => ({ id, ...data[id] }));

      arr.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(arr);
    });
  }, [activeConv]);

  // ----------------------------
  // 4️⃣ TYPING INDICATOR
  // ----------------------------

  const typingRef = user?.uid && activeConv?.id
    ? ref(realtimeDb, `typing/${activeConv.id}/${user.uid}`)
    : null;
  const theirTypingRef = receiver?.uid && activeConv?.id
    ? ref(realtimeDb, `typing/${activeConv.id}/${receiver.uid}`)
    : null;

  const handleTyping = (e) => {
    if (!activeConv?.id || !typingRef) return;

    if (e.target.value.length > 0) {
      if (!typing) {
        set(typingRef, true);
        setTyping(true);
      }
    } else {
      set(typingRef, false);
      setTyping(false);
    }
  };

  // Listen to their typing
  useEffect(() => {
    if (!theirTypingRef) return;

    return onValue(theirTypingRef, (snap) => {
      setTheirTyping(snap.val() === true);
    });
  }, [activeConv, receiver]);

  // ----------------------------
  // 5️⃣ SEND MESSAGE
  // ----------------------------

  const sendMessage = async () => {
    const text = msgRef.current.value.trim();
    if (!text || !activeConv?.id) return;

    const msgListRef = ref(realtimeDb, `messages/${activeConv.id}`);
    const newMsgRef = push(msgListRef);

    await set(newMsgRef, {
      senderId: user.uid,
      text,
      timestamp: Date.now(),
      seen: false,
    });

    // stop typing
    if (typingRef) {
      set(typingRef, false);
    }

    msgRef.current.value = "";
    setTyping(false);
  };

  // ----------------------------
  // 6️⃣ MARK MESSAGES AS SEEN
  // ----------------------------

  useEffect(() => {
    if (!messages.length || !activeConv?.id) return;
    messages.forEach((m) => {
      if (m.senderId !== user.uid && !m.seen) {
        const msgSeenRef = ref(realtimeDb, `messages/${activeConv.id}/${m.id}`);
        update(msgSeenRef, { seen: true });
      }
    });
  }, [messages, activeConv, user]);

  // ----------------------------
  // 7️⃣ UI
  // ----------------------------

  const renderStatus = () => {
    if (!status) return null;

    if (status.online) {
      return (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-green-500 rounded-full"></div>
          <span className="text-green-500 font-medium text-sm">Online</span>
        </div>
      );
    }

    return (
      <span className="text-gray-500 text-sm">
        Last seen: {status.lastSeen ? new Date(status.lastSeen).toLocaleString() : "—"}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="p-3 shadow flex items-center gap-3 bg-white">
        <img
          src={receiver?.photoURL || receiver?.image}
          alt={receiver?.name}
          className="w-10 h-10 rounded-full border border-green-500"
        />
        <div>
          <div className="font-semibold text-lg">{receiver?.name}</div>
          {renderStatus()}
          {theirTyping && (
            <div className="text-blue-500 text-sm animate-pulse">typing…</div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 overflow-y-auto bg-gray-100">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`my-2 flex ${m.senderId === user.uid ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`p-2 rounded-lg max-w-xs ${m.senderId === user.uid ? "bg-blue-200" : "bg-white"
                }`}
            >
              <div>{m.text}</div>

              {/* Instagram-style seen under the last message */}
              {m.senderId === user.uid ? (
                m.seen ? (
                  <div className="text-xs mt-1 text-blue-500">Seen</div>
                ) : (
                  <div className="text-xs mt-1 text-gray-500">Sent</div>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 bg-white flex gap-2">
        <input
          ref={msgRef}
          onChange={handleTyping}
          className="flex-1 border p-2 rounded"
          placeholder="Type a message…"
        />
        <button
          className="p-2 bg-blue-500 text-white rounded-lg"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default MessagesPage;