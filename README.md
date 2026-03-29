# DeepWork Timer

DeepWork is a real-time, cross-client collaborative Pomodoro desktop widget designed to synchronize focus sessions across multiple devices seamlessly. 

## Features
- **Real-Time Collaboration:** Connect to a "Room" and sync your Focus, Short Break, or Long Break timer instantly with friends or coworkers.
- **Customizable Timers:** Click the timer when paused to customize duration (supports minutes or `MM:SS` format).
- **Session Tracking:** Automatically tracks completed focus sessions natively within the UI with subtle dot indicators.
- **Role-Based Room Modes**:
  - 🤝 **Shared Mode:** Everyone in the room has full control to start, pause, skip, and edit the timer.
  - 👔 **Boss Mode:** The room creator has exclusive control. All joining members receive a "Spectator" UI with a synchronized read-only timer.
- **Dynamic Frameless Widget:** Translucent, always-on-top frameless window integrated tightly via Electron IPC, featuring custom Close and Minimize application buttons. 

## Technology Stack

The application is built upon a modern, highly performant technology stack encompassing both web and desktop environments:

*   **Frontend Interface:** React.js
*   **Build Tooling & Bundler:** Vite
*   **Styling Engine:** Tailwind CSS v4
*   **Desktop Wrapper:** Electron (Native Windows OS bindings)
*   **Real-Time Networking:** Socket.io
*   **Backend Server:** Node.js & Express.js (Hosted via Render)

## Architectural Design

DeepWork is designed as a distributed, full-stack application utilizing an embedded Chromium runtime over a constant bidirectional WebSocket connection.

### 1. Presentation Layer (Electron + React)
The user interface is powered entirely by React. To break out of typical browser constraints, the React bundle is securely compiled and embedded into an Electron native desktop shell. The Electron `BrowserWindow` handles OS-level features, explicitly stripping the Windows title barring to craft a transparent, frameless, floating application widget. Custom IPC bridges (`preload.cjs`) connect UI interface clicks back down to native OS calls (like minimizing or closing the window).

### 2. Network Layer (Socket.io)
Network persistence avoids conventional HTTP polling. The desktop client explicitly leverages Socket.io to establish a continuous TCP duplex connection to the cloud backend. When a user inputs a Room Code, they are securely subscribed to a compartmentalized WebSocket broadcast namespace.

### 3. Application State & Synchronization
System-level timer control relies on absolute distributed state.
*   **Action Initialization:** Pressing Start, Pause, or Reset transmits a discrete payload encapsulating the exact timer state and mode via the WebSocket channel.
*   **Server Multiplexing & Authority:** The Express backend intercepts this socket event. If the room is in "Boss Mode," the server explicitly validates the socket connection ID against the recorded room host. It then instantly broadcasts the payload directly back out to every other authorized participant.
*   **Client Reconciliation:** Bound peer clients receive the sub-second payload instruction and immediately override and lock their local React timer logic, creating instantaneous visual integration across multiple distinct computer addresses.

## Local Setup & Deployment

To clone the primary user interface subsystem locally:

```bash
git clone https://github.com/iamfardinn/DeepWork_Frontend.git
cd DeepWork_Frontend
npm install
```

### Starting the Development Environment
Concurrently mounts the Vite build server binding directly to the Electron development shell:

```bash
npm start
```

### Packaging the Final Application
When preparing the native Windows `.exe` application distribution:

```bash
npm run build:vite
npx electron-packager . "DeepWork Timer" --platform=win32 --arch=x64 --out=release-DeepWork --overwrite
```
The newly extracted native `release-DeepWork` directory is a fully optimized Chromium bundle. It acts as a fully standalone deployment, executable on any external Windows machine without relying on localized node dependencies.
