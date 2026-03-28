# DeepWork Timer

DeepWork is a real-time, cross-client collaborative Pomodoro desktop widget designed to synchronize focus sessions across multiple devices. 

## System Architecture

The application is structured as a full-stack, distributed web-to-desktop application relying on the following core technologies:

*   **Frontend User Interface:** Built using React.js and compiled via Vite for high-performance module reloading and minimal bundle sizes. 
*   **Desktop Environment:** The React application is embedded within an Electron runtime, granting it native operating system capabilities. The Electron `BrowserWindow` is purposefully configured to completely remove standard OS chrome (frameless) while maintaining true background transparency, resulting in a floating widget aesthetic rather than a traditional windowed application.
*   **Styling Engine:** All interface components and glass-morphism visual effects are driven natively by TailwindCSS v4.
*   **Real-Time Synchronization:** Network state is handled entirely by Socket.io. The desktop client maintains a persistent, bidirectional WebSocket connection to a centralized Node.js/Express backend service currently hosted on Render. 

## Synchronization Flow

When a user initializes a session:
1. The client establishes a Socket.io connection to the routing server.
2. The user inputs a specific Room Code ("xyz-123"). The Express backend subscribes that specific socket ID to a dedicated broadcast room.
3. Executing a state change (Start, Pause, Reset) forces the frontend to broadcast an event payload containing the timer state to the backend.
4. The server instantly multiplexes that exact timer payload to all other connected clients currently residing in the same room namespace, ensuring sub-second synchronization natively.

## Local Development Setup

To modify or compile the DeepWork desktop client locally, ensure you have Node.js installed, then clone the repository:

```bash
git clone https://github.com/iamfardinn/DeepWork_Frontend.git
cd DeepWork_Frontend
npm install
```

### Running the Development Environment

To begin development, run the following script. This will concurrently spin up the Vite development server and the Electron shell, linking them together for Hot-Module-Replacement (HMR).

```bash
npm start
```

### Packaging the Executable

When you are ready to distribute the final Windows executable, the project relies on `electron-packager` to natively compile the Chromium binaries. The packaging procedure requires parsing exactly the `dependencies` block (excluding `devDependencies` to optimize binary footprint). 

Before packaging, ensure the underlying React codebase has been transpiled into static bundles:

```bash
npm run build:vite
npx electron-packager . "DeepWork Timer" --platform=win32 --arch=x64 --out=release-final3 --overwrite
```

This generates a standalone `.exe` utilizing the integrated taskbar production assets.
