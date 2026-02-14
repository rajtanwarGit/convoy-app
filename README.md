🚗 Convoy Radar

A tactical, real-time GPS tracker for road trips.

Convoy Radar functions like a private "Waze" or "Google Maps" group session where one user (the Leader) dictates the route, and everyone else stays in sync. It features a minimal, high-contrast dark interface designed for night driving and battery efficiency.

✨ Key Features

📍 Real-Time Tracking: View all convoy members on a shared, lag-free map.

👑 Leader Trail: The host leaves a Neon Purple breadcrumb trail. If the leader takes a detour, followers see exactly where they went.

🔋 Smart Battery Eco: Uses adaptive GPS throttling. Updates frequently when moving fast, but sleeps when stopped to save your battery.

🛡️ Driver UI Lock: A dedicated "Lock Mode" prevents accidental touches if the phone is in a cup holder or pocket.

📏 Distance HUD: Tap any car to see the live distance between you and them.

🎮 Simulation Mode: Includes a realistic simulation (Jaipur -> Sikar) with AI bots ("Viper", "Goose") to test the app without driving.

🧹 Auto-Cleanup: Session data is automatically wiped from the cloud when the leader ends the trip.

🚀 Getting Started

Prerequisites

Node.js (v18 or higher)

A Google account (for Firebase)

1. Installation

# Clone the repository
git clone [https://github.com/your-username/convoy-radar.git](https://github.com/your-username/convoy-radar.git)

# Enter the directory
cd convoy-radar

# Install dependencies
npm install


2. Firebase Setup (Crucial)

This app uses Firebase Cloud Firestore for real-time syncing. You need your own free API keys.

Go to the Firebase Console.

Create a new project.

Enable Database: Go to Build > Firestore Database -> Create Database -> Select Test Mode.

Enable Auth: Go to Build > Authentication -> Get Started -> Enable Anonymous sign-in.

Get Keys: Go to Project Settings -> General -> Scroll down to "Your apps" -> Select Web (</>) -> Copy the firebaseConfig object.

3. Configuration

Open src/App.jsx and find the configuration section at the top. Paste your keys there:

// src/App.jsx
const firebaseConfig = {
  apiKey: "YOUR_PASTED_KEY",
  authDomain: "...",
  projectId: "...",
  // ... rest of your keys
};


4. Run Locally

npm run dev


Note: GPS features require HTTPS on mobile devices. For local testing on a phone, use the Simulation Mode or deploy to Vercel.

📱 How to Install (PWA)

You don't need an App Store. You can install this directly from the browser:

Deploy the app to Vercel (or use your Vercel link).

Open the link in Chrome (Android) or Safari (iOS).

Tap the Menu (Three dots or Share button).

Select "Add to Home Screen".

Launch the app from your home screen for a full-screen experience.

🛠️ Tech Stack

Frontend: React (Vite)

Styling: Tailwind CSS

Maps: Leaflet & OpenStreetMap (CartoDB Dark Matter tiles)

Backend: Firebase Firestore (Realtime DB) & Firebase Auth

Icons: Lucide React

📄 License

This project is open source and available under the MIT License.