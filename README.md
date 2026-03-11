# Conversa — MERN Real-Time Chat Application

<div align="center">

![MongoDB](https://img.shields.io/badge/MongoDB-%2347A248.svg?style=flat&logo=mongodb&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23000000.svg?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React%2019-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![Node.js](https://img.shields.io/badge/Node.js-%23339933.svg?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-%23000000.svg?style=flat&logo=socket.io&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-%2306B6D4.svg?style=flat&logo=tailwindcss&logoColor=white)
![Amazon S3](https://img.shields.io/badge/Amazon%20S3-FF9900?style=flat&logo=amazons3&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI-4285F4?style=flat&logo=google&logoColor=white)

A full-stack, production-grade real-time chat application built with the MERN stack and Socket.IO. Features include one-on-one messaging, a personalized AI chatbot powered by Google Gemini, image sharing via AWS S3, and a fully responsive dark/light UI built with React 19, TypeScript, Tailwind CSS v4, and shadcn/ui components.

</div>

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Data Models](#data-models)
- [REST API Reference](#rest-api-reference)
- [Socket.IO Events](#socketio-events)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Security Design](#security-design)
- [Background Jobs](#background-jobs)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Authentication
- **Register / Login** with email and password (bcrypt hashed, JWT issued with 7-day expiry)
- **OTP Login** — request a one-time password sent to email via Nodemailer / Gmail SMTP; time-limited, bcrypt-stored
- **Persistent sessions** — JWT stored in `localStorage`; `auth-token` header used on every API call
- **Profile management** — update name, about, profile picture, and change password (old password verification required)
- **Profile pictures** — uploaded directly from the browser to AWS S3 via pre-signed POST URLs (max 5 MB, images only)

### Messaging
- **Real-time one-on-one chat** over Socket.IO
- **Text and image messages** — images uploaded to S3 with optional caption text
- **Reply to message** — `replyTo` reference stored per message; displayed as quoted context in the UI
- **Delete for me** — hard-removes a message from your view only (appended to `hiddenFrom`)
- **Delete for everyone** — soft-delete sets `softDeleted: true`; message shows as *"This message was deleted"* tombstone for all members
- **Bulk hide** — hide multiple messages at once for yourself
- **Clear chat** — hide the entire conversation history from your view with a single action
- **Star / unstar messages** — bookmark individual messages; view all starred messages in a dedicated page
- **Seen receipts** — `seenBy` array tracks who read each message and when; updated on both room join and message load
- **Unread counts** — per-user unread counters maintained in the `Conversation` document, reset on room join
- **Latest message preview** — `latestmessage` field on `Conversation` keeps the chat list up to date

### AI Chatbot
- Every user gets a **personal AI Chatbot** conversation created automatically at registration
- Powered by **Google Gemini** (via `@google/genai`) with configurable model and temperature
- **Streaming responses** — bot replies are streamed chunk-by-chunk over Socket.IO (`bot-chunk`, `bot-done`) so text appears progressively
- **Context-aware** — last 19 text messages are sent as chat history on every request, giving the bot memory of the conversation
- **Typing indicator** — bot emits `typing` / `stop-typing` while generating
- **Rollback on error** — if the Gemini stream fails, the user message is deleted and `bot-error` is emitted

### Real-Time Presence & Notifications
- **Online / Offline status** — `isOnline` flag updated on connect/disconnect; broadcast to all conversation partners
- **Last seen** — timestamp recorded on disconnect and served via API
- **Multi-device / multi-tab aware** — `Map<userId, Set<socketId>>` tracks all open sockets; user is only marked offline when their *last* socket closes
- **Stale online cleanup** — background job runs every hour to force-offline users whose socket disconnect was missed (e.g. server crash)
- **Typing animation** — `typing` / `stop-typing` events broadcast to the conversation room *and* to the receiver's personal room if they are online but not in the chat
- **Push notification** — `new-message-notification` event sent to receiver's personal room when they are not inside the conversation

### Conversation Management
- **Start a conversation** — search for any registered user; reuses an existing conversation if one already exists
- **Conversations list** — sorted by `updatedAt` descending; pinned conversations always appear at the top
- **Pin / unpin conversations** — per-user; stored as `pinnedConversations` array on the User model
- **Block / unblock users** — `blockedUsers` array on the User model
  - Blocked users cannot send messages (checked server-side before every `send-message` socket event)
  - Blocked users see sanitized profile information (generic name, avatar, and offline status)
- **User discovery** — paginated, searchable, and sortable list of users with whom you have no existing conversation

### UI & UX
- **React 19** with full **TypeScript** type safety
- **Tailwind CSS v4** with **shadcn/ui** component library
- **Dark / Light mode** toggle powered by `next-themes`
- Fully **responsive** — optimised for both desktop and mobile
- **React Router v7** nested route layout system (`DashboardLayout` → `ConversationLayout`)
- **Sonner** toast notifications
- **Lottie** typing animation rendered via `react-lottie`
- **Markdown rendering** in bot messages via `react-markdown` + `remark-gfm`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS v4, shadcn/ui, React Router v7 |
| **Backend** | Node.js, Express.js 4 |
| **Database** | MongoDB (Mongoose 8) |
| **Real-time** | Socket.IO 4 (server + client) |
| **Authentication** | JSON Web Tokens (jsonwebtoken), bcryptjs |
| **AI** | Google Gemini via `@google/genai` |
| **File Storage** | AWS S3 (pre-signed POST uploads) |
| **Email** | Nodemailer (Gmail SMTP) |

---

## Project Structure

```
conversa/
├── backend/
│   ├── index.js                       # Express app entry point, HTTP server, Socket.IO init
│   ├── db.js                          # MongoDB connection
│   ├── secrets.js                     # Environment variable exports
│   ├── Controllers/
│   │   ├── auth-controller.js         # register, login, OTP, authUser
│   │   ├── conversation-controller.js # create, list, get, togglePin
│   │   ├── message-controller.js      # allMessage, delete, star, clear, AI streaming
│   │   └── user-controller.js         # profile, block, S3 presign, user search
│   ├── Models/
│   │   ├── User.js                    # blockedUsers, pinnedConversations, isBot, OTP
│   │   ├── Conversation.js            # members, latestmessage, unreadCounts
│   │   └── Message.js                 # seenBy, hiddenFrom, softDeleted, starredBy, replyTo
│   ├── Routes/
│   │   ├── auth-routes.js
│   │   ├── conversation-routes.js
│   │   ├── message-routes.js
│   │   └── user-routes.js
│   ├── socket/
│   │   ├── index.js                   # Socket.IO setup, JWT auth middleware, userSocketMap
│   │   └── handlers.js                # All socket event handlers
│   ├── middleware/
│   │   └── fetchUser.js               # JWT verification middleware for REST routes
│   ├── jobs/
│   │   └── staleOnlineUsers.js        # Hourly cleanup of stale isOnline flags
│   └── scripts/
│       ├── seed-test-users.js
│       └── delete-test-users.js
│
└── frontend/
    ├── src/
    │   ├── App.tsx                    # Route definitions
    │   ├── MainLayout.tsx             # Root layout with providers
    │   ├── lib/
    │   │   ├── api.ts                 # Centralized HTTP client (all API calls)
    │   │   ├── socket.ts              # Socket.IO client + emitter helpers
    │   │   └── utils.ts
    │   ├── context/
    │   │   ├── auth-provider.tsx
    │   │   ├── chat-provider.tsx
    │   │   └── conversations-provider.tsx
    │   ├── hooks/
    │   │   ├── use-auth.ts
    │   │   ├── use-chat.ts
    │   │   ├── use-conversations.ts
    │   │   ├── use-socket.ts
    │   │   └── use-mobile.ts
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   ├── Login.tsx
    │   │   ├── SignUp.tsx
    │   │   ├── Conversations.tsx
    │   │   ├── ConversationDetail.tsx
    │   │   ├── User.tsx               # User discovery / new chat
    │   │   ├── UserProfile.tsx
    │   │   └── StarredMessages.tsx
    │   └── components/
    │       ├── dashboard/             # ConversationsList, MessageInput, SingleMessage, etc.
    │       ├── layout/                # DashboardLayout, DashboardSidebar, ConversationLayout
    │       ├── ui/                    # shadcn/ui components
    │       ├── NotificationListener.tsx
    │       └── theme-provider.tsx
    └── public/
```

---

## Architecture Overview

```
Browser ──HTTP──▶  Express REST API  ──▶  MongoDB
        ──WS────▶  Socket.IO Server  ──▶  MongoDB

Socket.IO authentication
  Every socket connection presents a JWT in handshake.auth.token.
  The server verifies it and attaches socket.userId.
  Handlers never trust any client-supplied user ID.

Per-user socket tracking
  userSocketMap: Map<userId, Set<socketId>>
  Allows correct online/offline transitions across multiple tabs/devices.
  A user is marked offline only when their last socket disconnects.

AI streaming pipeline
  Browser ──send-message──▶  Server detects isBot member
                           ──▶  streamAiResponse() async generator
                           ──▶  yields: user-message → chunks → done
                           ──▶  emits: receive-message, bot-chunk, bot-done
```

---

## Data Models

### User

| Field | Type | Notes |
|---|---|---|
| `name` | String | 3–50 chars, required |
| `email` | String | unique, lowercase |
| `password` | String | bcrypt hashed |
| `about` | String | bio / status text |
| `profilePic` | String | URL; defaults to ui-avatars.com |
| `isOnline` | Boolean | updated on socket connect / disconnect |
| `lastSeen` | Date | set on disconnect |
| `isBot` | Boolean | `true` for AI bot accounts |
| `otp` | String | bcrypt hashed OTP for OTP login |
| `otpExpiry` | Date | OTP expiry timestamp |
| `blockedUsers` | [ObjectId → User] | users this user has blocked |
| `pinnedConversations` | [ObjectId → Conversation] | pinned conversation IDs |

### Conversation

| Field | Type | Notes |
|---|---|---|
| `members` | [ObjectId → User] | participants (always exactly 2) |
| `latestmessage` | String | preview text for chat list |
| `unreadCounts` | [{userId, count}] | per-member unread counter |
| `timestamps` | auto | `createdAt`, `updatedAt` |

### Message

| Field | Type | Notes |
|---|---|---|
| `conversationId` | ObjectId → Conversation | required |
| `senderId` | ObjectId → User | required |
| `text` | String | required if no `imageUrl` |
| `imageUrl` | String | required if no `text`; S3 URL |
| `seenBy` | [{user, seenAt}] | read receipts |
| `hiddenFrom` | [ObjectId → User] | hard-deleted for these users |
| `softDeleted` | Boolean | `true` = "deleted" tombstone shown to all |
| `starredBy` | [ObjectId → User] | users who starred this message |
| `replyTo` | ObjectId → Message | quoted reply reference |
| `timestamps` | auto | `createdAt`, `updatedAt` |

---

## REST API Reference

All protected routes require the header `auth-token: <JWT>`.

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account + personal bot + initial conversation |
| `POST` | `/auth/login` | — | Login with password or OTP |
| `POST` | `/auth/getotp` | — | Send OTP to email |
| `GET` | `/auth/me` | ✅ | Get authenticated user profile |

### Conversations — `/conversation`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/conversation` | ✅ | Create or retrieve a conversation |
| `GET` | `/conversation` | ✅ | List all conversations (pinned first, then by `updatedAt`) |
| `GET` | `/conversation/:id` | ✅ | Get a single conversation |
| `POST` | `/conversation/:id/pin` | ✅ | Toggle pin on a conversation |

### Messages — `/message`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/message/starred` | ✅ | Get all messages starred by the current user |
| `GET` | `/message/:id` | ✅ | Get all messages in a conversation (marks as seen) |
| `DELETE` | `/message/bulk/hide` | ✅ | Hide multiple messages for self (`body: { messageIds }`) |
| `DELETE` | `/message/:id` | ✅ | Delete a message (`body: { scope: "me" \| "everyone" }`) |
| `POST` | `/message/clear/:conversationId` | ✅ | Clear entire chat history for self |
| `POST` | `/message/:id/star` | ✅ | Toggle star on a message |

### Users — `/user`

| Method | Path | Auth | Description |
|---|---|---|---|
| `PUT` | `/user/update` | ✅ | Update profile (name, about, profilePic, password) |
| `GET` | `/user/online-status/:id` | ✅ | Get online status of a user |
| `GET` | `/user/non-friends` | ✅ | Paginated, searchable, sortable user discovery |
| `GET` | `/user/presigned-url` | ✅ | Get S3 pre-signed POST URL for image upload |
| `POST` | `/user/block/:id` | ✅ | Block a user |
| `DELETE` | `/user/block/:id` | ✅ | Unblock a user |
| `GET` | `/user/block-status/:id` | ✅ | Get mutual block status between current user and target |

#### `GET /user/non-friends` Query Parameters

| Param | Default | Options |
|---|---|---|
| `search` | `""` | name or email substring |
| `sort` | `name_asc` | `name_asc`, `name_desc`, `last_seen_recent`, `last_seen_oldest` |
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | 1–50 |

---

## Socket.IO Events

The socket server requires a valid JWT passed in `handshake.auth.token`.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `setup` | — | Join personal room; mark user online; notify friends |
| `join-chat` | `{ roomId }` | Join a conversation room; reset unread count; mark all messages seen |
| `leave-chat` | `roomId` | Leave a conversation room |
| `send-message` | `{ conversationId, text?, imageUrl? }` | Send a message (or trigger AI bot response) |
| `delete-message` | `{ messageId, conversationId, scope }` | Delete a message (`scope: "me" \| "everyone"`) |
| `typing` | `{ conversationId, typer, receiverId }` | Broadcast typing indicator |
| `stop-typing` | `{ conversationId, typer, receiverId }` | Broadcast stop-typing |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `user setup` | `userId` | Confirms setup complete |
| `user-joined-room` | `userId` | Another user entered the conversation room |
| `receive-message` | `Message` | New message delivered to room |
| `new-message-notification` | `{ message, sender, conversation }` | Push notification to receiver's personal room |
| `messages-seen` | `{ conversationId, seenBy, seenAt }` | Notifies sender their messages were read |
| `message-deleted` | `{ messageId, conversationId, softDeleted }` | Tombstone broadcast for scope="everyone" |
| `message-blocked` | `{ conversationId }` | Message rejected due to a block |
| `typing` | `{ conversationId, typer, receiverId? }` | Forwarded typing indicator |
| `stop-typing` | `{ conversationId, typer, receiverId? }` | Forwarded stop-typing indicator |
| `user-online` | `{ userId }` | A contact came online |
| `user-offline` | `{ userId }` | A contact went offline |
| `bot-chunk` | `{ conversationId, tempId, chunk }` | Streamed AI response text chunk |
| `bot-done` | `{ conversationId, tempId, message }` | AI response complete; `message` is the saved document |
| `bot-error` | `{ conversationId, userMessageId? }` | AI response failed; provides rolled-back message ID |

---

## Environment Variables

### Backend — `backend/.env`

```env
# MongoDB
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net
MONGO_DB_NAME=conversa

# JWT
JWT_SECRET=your_jwt_secret_here

# CORS — frontend origin
CORS_ORIGIN=http://localhost:5173

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# AWS S3 (for image uploads)
AWS_BUCKET_NAME=your_bucket_name
AWS_ACCESS_KEY=your_aws_access_key_id
AWS_SECRET=your_aws_secret_access_key

# Nodemailer — Gmail SMTP for OTP emails
EMAIL=your_gmail_address@gmail.com
PASSWORD=your_gmail_app_password
```

### Frontend — `frontend/src/.env`

```env
# Backend API base URL (also used for Socket.IO)
VITE_API_URL=http://localhost:5500
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- A running **MongoDB** instance (Atlas free tier works fine)
- An **AWS S3** bucket with CORS configured to allow your frontend origin
- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/)
- A **Gmail account** with an [App Password](https://myaccount.google.com/apppasswords) enabled for OTP emails

### Installation

```bash
# 1. Clone
git clone https://github.com/pankil-soni/mern-chat-app.git
cd mern-chat-app

# 2. Backend
cd backend
npm install
# Copy and fill in your values
cp .env.example .env

# 3. Frontend
cd ../frontend
npm install
# Create frontend/src/.env and set VITE_API_URL
```

### Run in Development

```bash
# Terminal 1 — backend (port 5500)
cd backend
node index.js

# Terminal 2 — frontend (port 5173)
cd frontend
npm run dev
```

Open `http://localhost:5173`.

### Build for Production

```bash
cd frontend
npm run build   # outputs to frontend/dist/
```

Serve `dist/` with any static host and deploy the backend with a process manager such as PM2.

---

## Scripts

### Backend

| Script | Command | Description |
|---|---|---|
| `seed:users` | `npm run seed:users` | Seed guest test accounts into the database |
| `delete:users` | `npm run delete:users` | Remove seeded test accounts |

### Frontend

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start Vite dev server with HMR |
| `build` | `npm run build` | TypeScript check + Vite production build |
| `preview` | `npm run preview` | Preview production build locally |
| `lint` | `npm run lint` | ESLint |
| `format` | `npm run format` | Prettier (all `*.ts` / `*.tsx` files) |
| `typecheck` | `npm run typecheck` | `tsc --noEmit` type check without emitting |

---

## Security Design

| Concern | Approach |
|---|---|
| Password storage | bcrypt, salt rounds = 10 |
| OTP storage | bcrypt hashed before persisting to database |
| JWT | 7-day expiry; verified in REST middleware **and** Socket.IO handshake middleware |
| Socket identity | `socket.userId` set server-side by JWT verification; handlers never trust client-supplied IDs |
| Conversation membership | Every socket handler and REST controller verifies membership before reading or writing |
| Block enforcement | Block check performed server-side before every `send-message` event; blocked users receive sanitized profiles |
| S3 upload authorization | Short-lived (15 min) pre-signed POST URLs scoped to `conversa/<userId>/`; 5 MB size cap enforced by S3 policy |
| CORS | Configurable `CORS_ORIGIN` for both Express and Socket.IO |

---

## Background Jobs

### Stale Online Users — `backend/jobs/staleOnlineUsers.js`

Runs **immediately on server start**, then repeats every **1 hour**.

Finds all users where `isOnline: true` and `updatedAt < (now − 1 hour)` and marks them offline, setting `lastSeen` to their actual `updatedAt` value. This corrects users left permanently online due to a missed socket disconnect (e.g. server restart, network drop, ungraceful client exit).

---

## Guest Accounts

Two pre-seeded accounts are available for quick testing:

```
Email:    guestuser1@gmail.com  /  guestuser2@gmail.com
Password: 1234guest
```

---

## Roadmap

- [x] Real-time one-on-one messaging
- [x] AI chatbot with streaming and context memory
- [x] Image messages (S3)
- [x] OTP login
- [x] Delete for me / delete for everyone
- [x] Star / unstar messages + starred messages page
- [x] Pin conversations
- [x] Block / unblock users
- [x] Clear chat
- [x] Multi-device online presence
- [ ] Reply to message
- [ ] Message reactions
- [ ] Group conversations
- [ ] Double-tick read receipt UI
- [ ] Delete My Account feature

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

MIT — see the [LICENSE](LICENSE) file for details.

---

## About the Author

Built by **Pankil Soni**

- Email: pmsoni2016@gmail.com
- LinkedIn: [pankil-soni-5a0541170](https://www.linkedin.com/in/pankil-soni-5a0541170/)
- Kaggle: [pankilsoni](https://www.kaggle.com/pankilsoni)
