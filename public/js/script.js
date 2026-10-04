const socket = io();

let currentUser = null;
let currentChatType = null;
let currentRoomId = null;
let currentUserId = null;

let typingTimeout = null;

const currentUsername = document.getElementById("currentUsername");
const currentUserAvatar = document.getElementById("currentUserAvatar");

const roomsList = document.getElementById("roomsList");
const usersList = document.getElementById("usersList");

const chatTitle = document.getElementById("chatTitle");
const chatSubtitle = document.getElementById("chatSubtitle");
const chatAvatar = document.getElementById("chatAvatar");

const messagesContainer = document.getElementById("messagesContainer");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const typingIndicator = document.getElementById("typingIndicator");

const logoutBtn = document.getElementById("logoutBtn");

const createRoomBtn = document.getElementById("createRoomBtn");
const roomModal = document.getElementById("roomModal");
const closeRoomModal = document.getElementById("closeRoomModal");
const createRoomForm = document.getElementById("createRoomForm");
const roomName = document.getElementById("roomName");
const roomMessage = document.getElementById("roomMessage");


/* =========================
   INITIAL LOAD
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentUser();
  await loadRooms();
  await loadUsers();
});


/* =========================
   CURRENT USER
========================= */

async function loadCurrentUser() {
  try {
    const response = await fetch("/api/me");

    if (!response.ok) {
      window.location.href = "/";
      return;
    }

    const data = await response.json();

    currentUser = data.user;

    currentUsername.textContent = currentUser.username;

    currentUserAvatar.textContent =
      currentUser.username.charAt(0).toUpperCase();

  } catch (error) {
    console.error("Unable to load current user:", error);
    window.location.href = "/";
  }
}


/* =========================
   LOAD ROOMS
========================= */

async function loadRooms() {
  try {
    const response = await fetch("/api/rooms");

    if (!response.ok) {
      roomsList.innerHTML =
        '<p class="empty-text">Unable to load rooms.</p>';
      return;
    }

    /*
      IMPORTANT:
      /api/rooms returns an array directly:

      [
        { name: "General" },
        { name: "General01" }
      ]

      So we use data directly instead of data.rooms.
    */
    const rooms = await response.json();

    roomsList.innerHTML = "";

    if (!rooms || rooms.length === 0) {
      roomsList.innerHTML =
        '<p class="empty-text">No rooms yet.</p>';
      return;
    }

    rooms.forEach((room) => {
      const button = document.createElement("button");

      button.className = "room-item";

      button.innerHTML = `
        <span class="room-icon">#</span>
        <span>${escapeHtml(room.name)}</span>
      `;

      button.addEventListener("click", () => {
        openRoom(room);
      });

      roomsList.appendChild(button);
    });

  } catch (error) {
    console.error("Unable to load rooms:", error);

    roomsList.innerHTML =
      '<p class="empty-text">Unable to load rooms.</p>';
  }
}


/* =========================
   LOAD USERS
========================= */

async function loadUsers() {
  try {
    const response = await fetch("/api/users");

    if (!response.ok) {
      usersList.innerHTML =
        '<p class="empty-text">Unable to load users.</p>';
      return;
    }

    const data = await response.json();

    usersList.innerHTML = "";

    const users = Array.isArray(data)
      ? data
      : (data.users || []);

    if (users.length === 0) {
      usersList.innerHTML =
        '<p class="empty-text">No other users.</p>';
      return;
    }

    users.forEach((user) => {
      const button = document.createElement("button");

      button.className = "user-item";

      const firstLetter =
        user.username.charAt(0).toUpperCase();

      const statusText =
        user.online ? "Online" : "Offline";

      button.innerHTML = `
        <div class="user-avatar-small">
          ${escapeHtml(firstLetter)}
        </div>

        <div class="user-info-small">
          <strong>${escapeHtml(user.username)}</strong>
          <span class="user-status">
            ${statusText}
          </span>
        </div>
      `;

      button.addEventListener("click", () => {
        openPrivateChat(user);
      });

      usersList.appendChild(button);
    });

  } catch (error) {
    console.error("Unable to load users:", error);

    usersList.innerHTML =
      '<p class="empty-text">Unable to load users.</p>';
  }
}


/* =========================
   OPEN ROOM
========================= */

async function openRoom(room) {
  currentChatType = "room";
  currentRoomId = room._id;
  currentUserId = null;

  chatTitle.textContent = `# ${room.name}`;
  chatSubtitle.textContent = "Chat room";

  chatAvatar.textContent = "#";

  messageInput.disabled = false;
  sendBtn.disabled = false;

  messageInput.placeholder =
    `Message #${room.name}`;

  clearActiveItems();

  const roomButtons =
    document.querySelectorAll(".room-item");

  roomButtons.forEach((button) => {
    if (button.textContent.includes(room.name)) {
      button.classList.add("active");
    }
  });

  messagesContainer.innerHTML = "";

  socket.emit("joinRoom", {
    roomId: room._id
  });

  await loadRoomMessages(room._id);
}


/* =========================
   LOAD ROOM MESSAGES
========================= */

async function loadRoomMessages(roomId) {
  try {
    const response =
      await fetch(`/api/messages/room/${roomId}`);

    if (!response.ok) {
      showEmptyMessages("Unable to load messages.");
      return;
    }

    const data = await response.json();

    messagesContainer.innerHTML = "";

    const messages = Array.isArray(data)
      ? data
      : (data.messages || []);

    if (messages.length === 0) {
      showEmptyMessages(
        "No messages yet. Start the conversation!"
      );
      return;
    }

    messages.forEach((message) => {
      addMessageToUI(message);
    });

    scrollToBottom();

  } catch (error) {
    console.error(
      "Unable to load room messages:",
      error
    );

    showEmptyMessages("Unable to load messages.");
  }
}


/* =========================
   OPEN PRIVATE CHAT
========================= */

async function openPrivateChat(user) {
  currentChatType = "private";
  currentRoomId = null;
  currentUserId = user._id;

  chatTitle.textContent = user.username;

  chatSubtitle.textContent =
    user.online ? "Online" : "Offline";

  chatAvatar.textContent =
    user.username.charAt(0).toUpperCase();

  messageInput.disabled = false;
  sendBtn.disabled = false;

  messageInput.placeholder =
    `Message ${user.username}`;

  clearActiveItems();

  const userButtons =
    document.querySelectorAll(".user-item");

  userButtons.forEach((button) => {
    if (button.textContent.includes(user.username)) {
      button.classList.add("active");
    }
  });

  messagesContainer.innerHTML = "";

  await loadPrivateMessages(user._id);
}


/* =========================
   LOAD PRIVATE MESSAGES
========================= */

async function loadPrivateMessages(userId) {
  try {
    const response =
      await fetch(`/api/messages/private/${userId}`);

    if (!response.ok) {
      showEmptyMessages("Unable to load messages.");
      return;
    }

    const data = await response.json();

    messagesContainer.innerHTML = "";

    const messages = Array.isArray(data)
      ? data
      : (data.messages || []);

    if (messages.length === 0) {
      showEmptyMessages(
        "No private messages yet. Say hello!"
      );
      return;
    }

    messages.forEach((message) => {
      addMessageToUI(message);
    });

    scrollToBottom();

  } catch (error) {
    console.error(
      "Unable to load private messages:",
      error
    );

    showEmptyMessages("Unable to load messages.");
  }
}


/* =========================
   SEND MESSAGE
========================= */

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  if (currentChatType === "room" && currentRoomId) {

    socket.emit("sendRoomMessage", {
      roomId: currentRoomId,
      text
    });

  } else if (
    currentChatType === "private" &&
    currentUserId
  ) {

    socket.emit("sendPrivateMessage", {
      recipientId: currentUserId,
      text
    });

  } else {
    return;
  }

  messageInput.value = "";

  stopTyping();
});


/* =========================
   RECEIVE ROOM MESSAGE
========================= */

socket.on("newRoomMessage", (message) => {

  const messageRoomId =
    message.room?._id || message.room;

  if (
    currentChatType === "room" &&
    String(currentRoomId) === String(messageRoomId)
  ) {
    removeEmptyMessage();
    addMessageToUI(message);
    scrollToBottom();
  }

});


/* =========================
   RECEIVE PRIVATE MESSAGE
========================= */

socket.on("newPrivateMessage", (message) => {

  const senderId =
    message.sender?._id || message.sender;

  const recipientId =
    message.recipient?._id || message.recipient;

  const isCurrentConversation =
    currentChatType === "private" &&
    (
      String(senderId) === String(currentUserId) ||
      String(recipientId) === String(currentUserId)
    );

  if (isCurrentConversation) {
    removeEmptyMessage();
    addMessageToUI(message);
    scrollToBottom();
  }

  if (
    currentUser &&
    String(senderId) !== String(currentUser._id)
  ) {
    showNotification(
      "New message",
      "You received a new private message."
    );
  }

});


/* =========================
   SOCKET CONNECTION
========================= */

socket.on("connect", () => {
  console.log("Connected to ChatFlow server.");
});

socket.on("disconnect", () => {
  console.log("Disconnected from ChatFlow server.");
});


/* =========================
   TYPING
========================= */

messageInput.addEventListener("input", () => {

  if (
    currentChatType !== "room" ||
    !currentRoomId
  ) {
    return;
  }

  socket.emit("typing", {
    roomId: currentRoomId
  });

  clearTimeout(typingTimeout);

  typingTimeout = setTimeout(() => {
    stopTyping();
  }, 1000);

});


function stopTyping() {

  clearTimeout(typingTimeout);

  if (
    currentChatType === "room" &&
    currentRoomId
  ) {
    socket.emit("stopTyping", {
      roomId: currentRoomId
    });
  }

}


socket.on("userTyping", (data) => {

  typingIndicator.textContent =
    `${data.username} is typing...`;

});


socket.on("userStoppedTyping", () => {

  typingIndicator.textContent = "";

});


/* =========================
   PRESENCE
========================= */

socket.on("userOnline", (data) => {

  console.log(`${data.username} is online`);

  loadUsers();

});


socket.on("userOffline", (data) => {

  console.log(`${data.username} is offline`);

  loadUsers();

});


/* =========================
   NOTIFICATIONS
========================= */

socket.on("notification", (data) => {

  showNotification(
    data.title || "ChatFlow",
    data.message || "New notification"
  );

});


/* =========================
   ADD MESSAGE TO UI
========================= */

function addMessageToUI(message) {

  const senderId =
    message.sender?._id || message.sender;

  const senderName =
    message.sender?.username ||
    "User";

  const isOwn =
    currentUser &&
    String(senderId) === String(currentUser._id);

  const messageWrapper =
    document.createElement("div");

  messageWrapper.className =
    `message ${isOwn ? "own" : "other"}`;

  const senderHTML =
    !isOwn && currentChatType === "room"
      ? `<div class="message-sender">
           ${escapeHtml(senderName)}
         </div>`
      : "";

  const messageText =
    escapeHtml(message.text || "");

  const time =
    formatTime(message.createdAt);

  messageWrapper.innerHTML = `
    ${senderHTML}

    <div class="message-bubble">
      ${messageText}
    </div>

    <div class="message-meta">
      ${time}
    </div>
  `;

  messagesContainer.appendChild(messageWrapper);
}


/* =========================
   EMPTY MESSAGE
========================= */

function showEmptyMessages(text) {

  messagesContainer.innerHTML = `
    <div class="welcome-message empty-message">
      <div class="welcome-icon">
        💬
      </div>

      <p>${escapeHtml(text)}</p>
    </div>
  `;

}


function removeEmptyMessage() {

  const emptyMessage =
    document.querySelector(".empty-message");

  if (emptyMessage) {
    emptyMessage.remove();
  }

}


/* =========================
   ACTIVE ITEMS
========================= */

function clearActiveItems() {

  document
    .querySelectorAll(".room-item, .user-item")
    .forEach((item) => {
      item.classList.remove("active");
    });

}


/* =========================
   CREATE ROOM
========================= */

createRoomBtn.addEventListener("click", () => {

  roomModal.classList.remove("hidden");

  roomName.focus();

});


closeRoomModal.addEventListener("click", () => {

  roomModal.classList.add("hidden");

  createRoomForm.reset();

  roomMessage.textContent = "";

});


roomModal.addEventListener("click", (event) => {

  if (event.target === roomModal) {
    roomModal.classList.add("hidden");
  }

});


createRoomForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const name =
      roomName.value.trim();

    if (!name) {
      return;
    }

    roomMessage.textContent = "";
    roomMessage.className = "form-message";

    try {

      const response =
        await fetch("/api/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name
          })
        });

      const data =
        await response.json();

      if (!response.ok) {

        roomMessage.textContent =
          data.message ||
          "Unable to create room.";

        roomMessage.classList.add("error");

        return;
      }

      roomMessage.textContent =
        "Room created successfully!";

      roomMessage.classList.add("success");

      createRoomForm.reset();

      await loadRooms();

      setTimeout(() => {

        roomModal.classList.add("hidden");

        roomMessage.textContent = "";

      }, 600);

    } catch (error) {

      console.error(
        "Unable to create room:",
        error
      );

      roomMessage.textContent =
        "Unable to connect to server.";

      roomMessage.classList.add("error");
    }

  }
);


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener("click", async () => {

  try {

    await fetch("/api/logout", {
      method: "POST"
    });

  } catch (error) {

    console.error(
      "Logout error:",
      error
    );

  }

  window.location.href = "/";
});


/* =========================
   NOTIFICATION
========================= */

function showNotification(title, message) {

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {

    new Notification(title, {
      body: message
    });

  }

}


/* =========================
   REQUEST NOTIFICATION ACCESS
========================= */

if (
  "Notification" in window &&
  Notification.permission === "default"
) {

  Notification.requestPermission();

}


/* =========================
   HELPERS
========================= */

function scrollToBottom() {

  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;

}


function formatTime(dateString) {

  if (!dateString) {
    return "";
  }

  const date =
    new Date(dateString);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}