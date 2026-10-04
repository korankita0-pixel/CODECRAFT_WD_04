# 💬 ChatFlow — Real-Time Chat Application

ChatFlow is a full-stack real-time chat application developed as part of the **CodeCraft Infotech Full Stack Web Development Internship — Task 4**.

It allows users to create accounts, join chat rooms, send real-time messages, communicate privately, view chat history, see online/offline status, and receive notifications.

---

## 🚀 Features

- 🔐 User registration and login
- 🔒 Session-based authentication
- 💬 Real-time messaging using Socket.IO
- 👥 Public chat rooms
- 🧑‍🤝‍🧑 Private one-to-one conversations
- 🕒 Persistent chat history
- 🟢 Online/offline user presence
- ⌨️ Typing indicators
- 🔔 Browser notifications
- 🗄️ MongoDB database integration
- 🔑 Password hashing using bcrypt
- 🛡️ Security headers using Helmet
- 🎨 Modern animated and responsive UI
- 📱 Responsive design for different screen sizes

---

## 🛠️ Technologies Used

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- Socket.IO

### Database
- MongoDB
- Mongoose

### Authentication & Security
- Express Session
- Connect Mongo
- bcryptjs
- Helmet
- dotenv

---

## 📁 Project Structure

```text
CODECRAFT_WD_04/
│
├── config/
│   └── database.js
│
├── middleware/
│   └── authMiddleware.js
│
├── models/
│   ├── User.js
│   ├── Room.js
│   └── Message.js
│
├── public/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
│
├── views/
│   ├── login.html
│   ├── register.html
│   └── chat.html
│
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
└── README.md