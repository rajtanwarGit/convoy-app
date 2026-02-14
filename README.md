🚗 Convoy Radar

A tactical, real-time GPS tracker for road trips.

Convoy Radar functions like a private "Waze" group session where one user (the Leader) dictates the route, and everyone else stays in sync. It features a minimal, high-contrast dark interface designed for night driving and battery efficiency.

✨ Key Features

📍 Real-Time Tracking: View all convoy members on a shared, lag-free map.

👑 Leader Trail: The host leaves a Neon Purple breadcrumb trail showing their exact path.

🔋 Smart Battery Eco: Adaptive GPS throttling saves battery while stopped.

🛡️ Driver UI Lock: Prevents accidental touches while the phone is in a cup holder.

📏 Distance HUD: Tap any car to see the live distance from you.

🎮 Simulation Mode: Includes a realistic simulation to test the app without driving.

📱 How to Use (PWA)

No App Store required. You can install this directly from your browser for a full-screen experience:

Open the deployed link in Chrome (Android) or Safari (iOS).

Tap the Menu (Three dots ⋮ or Share button).

Select "Add to Home Screen".

Launch the app from your home screen.

💻 Local Development

Clone & Install:

git clone [https://github.com/your-username/convoy-radar.git](https://github.com/your-username/convoy-radar.git)
cd convoy-radar
npm install


Setup Firebase:

Create a project at Firebase Console.

Enable Firestore Database (Test Mode) and Authentication (Anonymous).

Copy your firebaseConfig and paste it into src/App.jsx.

Run:

npm run dev


🛠️ Tech Stack

Frontend: React (Vite) + Tailwind CSS

Maps: Leaflet & OpenStreetMap (CartoDB Dark Matter tiles)

Backend: Firebase Firestore & Auth

📄 License

This project is open source and available under the MIT License.