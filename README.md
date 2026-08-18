# Mood Wala Radio

A live radio web application that streams music dynamically based on playlists. It provides a real-time synchronized listening experience for all connected users globally.

## Features

- Real-Time Synchronization: All listeners experience the exact same playback position in real-time.
- Admin Panel: Secure admin interface to switch playlists, skip tracks, and play direct links.
- Rooms System: Create or join private listening rooms.
- Dynamic Backgrounds: Seamless, looping background videos that randomly change when a new track plays.
- Live Statistics: Real-time global and room-specific listener counts.
- Song Requests: Listeners can submit song requests which appear in the admin dashboard.

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript, YouTube IFrame API.
- Backend: Node.js, Express, Socket.io for real-time bidirectional event-based communication.

## Setup Instructions

1. Clone the repository.
2. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Set up your environment variables. You will need a YouTube Data API v3 key and an Admin password.
4. Start the backend server:
   ```bash
   node server.js
   ```
5. Serve the frontend folder using any static HTTP server. Update the backend URL variable in `app.js` to point to your running server.

## License

This project is open-source and available under the MIT License.
