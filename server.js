require("dotenv").config();

const path = require("path");
const http = require("http");

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcryptjs");
const helmet = require("helmet");

const { Server } = require("socket.io");

const connectDB = require("./config/database");

const User = require("./models/User");
const Room = require("./models/Room");
const Message = require("./models/Message");

const requireAuth = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --------------------------------------------------
// DATABASE
// --------------------------------------------------

connectDB();

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),

  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: "lax"
  }
});

app.use(sessionMiddleware);

// Allow Socket.IO to access the same session
io.engine.use(sessionMiddleware);

// --------------------------------------------------
// PAGE ROUTES
// --------------------------------------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "chat.html"));
});

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({
        message: "Username must be at least 3 characters"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username or email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash
    });

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Registration failed"
    });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    user.online = true;
    user.lastSeen = new Date();

    await user.save();

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Login failed"
    });
  }
});

// Logout
app.post("/api/logout", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    await User.findByIdAndUpdate(userId, {
      online: false,
      lastSeen: new Date()
    });

    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({
          message: "Logout failed"
        });
      }

      res.json({
        message: "Logged out successfully"
      });
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.status(500).json({
      message: "Logout failed"
    });
  }
});

// Current user
app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    user: req.user
  });
});

// --------------------------------------------------
// USERS
// --------------------------------------------------

app.get("/api/users", requireAuth, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id }
    })
      .select("_id username online lastSeen")
      .sort({ username: 1 });

    res.json(users);
  } catch (error) {
    console.error("Users error:", error);

    res.status(500).json({
      message: "Could not load users"
    });
  }
});

// --------------------------------------------------
// ROOMS
// --------------------------------------------------

// Get rooms
app.get("/api/rooms", requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate("createdBy", "username")
      .sort({ createdAt: 1 });

    res.json(rooms);
  } catch (error) {
    console.error("Rooms error:", error);

    res.status(500).json({
      message: "Could not load rooms"
    });
  }
});

// Create room
app.post("/api/rooms", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        message: "Room name must contain at least 2 characters"
      });
    }

    const roomName = name.trim();

    const existingRoom = await Room.findOne({
      name: roomName
    });

    if (existingRoom) {
      return res.status(409).json({
        message: "A room with this name already exists"
      });
    }

    const room = await Room.create({
      name: roomName,
      createdBy: req.user._id,
      members: [req.user._id]
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Create room error:", error);

    res.status(500).json({
      message: "Could not create room"
    });
  }
});

// --------------------------------------------------
// MESSAGE HISTORY
// --------------------------------------------------

// Room message history
app.get(
  "/api/messages/room/:roomId",
  requireAuth,
  async (req, res) => {
    try {
      const { roomId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({
          message: "Invalid room ID"
        });
      }

      const messages = await Message.find({
        room: roomId
      })
        .populate("sender", "username")
        .sort({ createdAt: 1 })
        .limit(100);

      res.json(messages);
    } catch (error) {
      console.error("Room messages error:", error);

      res.status(500).json({
        message: "Could not load messages"
      });
    }
  }
);

// Private message history
app.get(
  "/api/messages/private/:userId",
  requireAuth,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          message: "Invalid user ID"
        });
      }

      const messages = await Message.find({
        room: null,
        $or: [
          {
            sender: req.user._id,
            recipient: userId
          },
          {
            sender: userId,
            recipient: req.user._id
          }
        ]
      })
        .populate("sender", "username")
        .populate("recipient", "username")
        .sort({ createdAt: 1 })
        .limit(100);

      res.json(messages);
    } catch (error) {
      console.error("Private messages error:", error);

      res.status(500).json({
        message: "Could not load private messages"
      });
    }
  }
);

// --------------------------------------------------
// SOCKET.IO
// --------------------------------------------------

const connectedUsers = new Map();

io.on("connection", async (socket) => {
  try {
    const session = socket.request.session;

    if (!session || !session.userId) {
      socket.disconnect(true);
      return;
    }

    const userId = session.userId;

    const user = await User.findById(userId);

    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.userId = user._id.toString();
    socket.username = user.username;

    connectedUsers.set(socket.userId, socket.id);

    await User.findByIdAndUpdate(userId, {
      online: true,
      lastSeen: new Date()
    });

    io.emit("presence:update", {
      userId: socket.userId,
      username: socket.username,
      online: true
    });

    console.log(`${socket.username} connected`);

    // ----------------------------------------------
    // Join room
    // ----------------------------------------------

    socket.on("joinRoom", async (roomId) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          return;
        }

        socket.join(`room:${roomId}`);

        const room = await Room.findById(roomId);

        if (
          room &&
          !room.members.some(
            (member) => member.toString() === socket.userId
          )
        ) {
          room.members.push(socket.userId);
          await room.save();
        }
      } catch (error) {
        console.error("Join room error:", error);
      }
    });

    // ----------------------------------------------
    // Leave room
    // ----------------------------------------------

    socket.on("leaveRoom", (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    // ----------------------------------------------
    // Send room message
    // ----------------------------------------------

    socket.on("sendRoomMessage", async (data) => {
      try {
        const { roomId, text } = data;

        if (!roomId || !text || !text.trim()) {
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          return;
        }

        const cleanText = text.trim();

        if (cleanText.length > 2000) {
          return;
        }

        const message = await Message.create({
          sender: socket.userId,
          room: roomId,
          text: cleanText,
          type: "text"
        });

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "username");

        io.to(`room:${roomId}`).emit(
          "newRoomMessage",
          populatedMessage
        );
      } catch (error) {
        console.error("Room message error:", error);
      }
    });

    // ----------------------------------------------
    // Send private message
    // ----------------------------------------------

    socket.on("sendPrivateMessage", async (data) => {
      try {
        const { recipientId, text } = data;

        if (!recipientId || !text || !text.trim()) {
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
          return;
        }

        const cleanText = text.trim();

        if (cleanText.length > 2000) {
          return;
        }

        const recipient = await User.findById(recipientId);

        if (!recipient) {
          return;
        }

        const message = await Message.create({
          sender: socket.userId,
          recipient: recipientId,
          text: cleanText,
          type: "text"
        });

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "username")
          .populate("recipient", "username");

        socket.emit(
          "newPrivateMessage",
          populatedMessage
        );

        const recipientSocketId = connectedUsers.get(
          recipientId.toString()
        );

        if (recipientSocketId) {
          io.to(recipientSocketId).emit(
            "newPrivateMessage",
            populatedMessage
          );

          io.to(recipientSocketId).emit(
            "notification",
            {
              type: "private-message",
              from: socket.username,
              message: cleanText
            }
          );
        }
      } catch (error) {
        console.error("Private message error:", error);
      }
    });

    // ----------------------------------------------
    // Typing indicator
    // ----------------------------------------------

    socket.on("typing", (data) => {
      if (!data || !data.roomId) {
        return;
      }

      socket.to(`room:${data.roomId}`).emit("userTyping", {
        username: socket.username
      });
    });

    socket.on("stopTyping", (data) => {
      if (!data || !data.roomId) {
        return;
      }

      socket.to(`room:${data.roomId}`).emit("userStoppedTyping", {
        username: socket.username
      });
    });

    // ----------------------------------------------
    // Disconnect
    // ----------------------------------------------

    socket.on("disconnect", async () => {
      connectedUsers.delete(socket.userId);

      await User.findByIdAndUpdate(socket.userId, {
        online: false,
        lastSeen: new Date()
      });

      io.emit("presence:update", {
        userId: socket.userId,
        username: socket.username,
        online: false
      });

      console.log(`${socket.username} disconnected`);
    });
  } catch (error) {
    console.error("Socket connection error:", error);
  }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

server.listen(PORT, () => {
  console.log(`ChatFlow server running at http://localhost:${PORT}`);
});