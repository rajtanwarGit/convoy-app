import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Navigation, Crown, Zap, Share2, LogOut, ArrowRight, 
  Locate, AlertTriangle, Trash2, Settings, Lock, Unlock, X, Eraser, BatteryCharging, Shield, ShieldCheck, ChevronRight
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, doc, setDoc, onSnapshot, updateDoc, 
  collection, deleteDoc, serverTimestamp, getDocs, writeBatch, arrayUnion 
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

/**
 * CONVOY WEB APP - CLOUD EDITION (V4.5 - Accuracy Filter)
 * * Features:
 * 1. Real-time Cloud Sync.
 * 2. Realistic Simulation.
 * 3. Non-blocking Distance HUD.
 * 4. Room Validation & Auto-Cleanup.
 * 5. Smart GPS Throttling.
 * 6. Slide-to-Unlock UI.
 * 7. GPS Accuracy Filter (Prevents zigzag trails).
 */

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBh8K4oKBaGwAQSJJ016jYkrMgl92x3Lr8",
  authDomain: "convoy-radar.firebaseapp.com",
  projectId: "convoy-radar",
  storageBucket: "convoy-radar.firebasestorage.app",
  messagingSenderId: "962486154653",
  appId: "1:962486154653:web:60bcea4afb105b82f56b74",
  measurementId: "G-HBYJDHZ9J4"
};

// Initialize Firebase
let db, auth;
try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    signInAnonymously(auth).catch(console.error);
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// --- UTILS ---
const generateSessionId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
};

const CAR_COLORS = [
  { name: 'Neon Blue', hex: '#3b82f6' },
  { name: 'Neon Green', hex: '#10b981' },
  { name: 'Hot Pink', hex: '#ec4899' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Rose', hex: '#f43f5e' },
];

// --- SWIPE TO UNLOCK COMPONENT ---
const SwipeToUnlock = ({ onUnlock }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const maxDrag = useRef(0);

  useEffect(() => {
    if (containerRef.current) {
      maxDrag.current = containerRef.current.clientWidth - 56; 
    }
  }, []);

  const handleStart = () => setIsDragging(true);

  const handleEnd = () => {
    setIsDragging(false);
    if (dragX > maxDrag.current * 0.9) {
      onUnlock();
    } else {
      setDragX(0); 
    }
  };

  const handleMove = (clientX) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left - 28; 
    const clamped = Math.min(Math.max(0, x), maxDrag.current);
    setDragX(clamped);
  };

  useEffect(() => {
    const onTouchMove = (e) => handleMove(e.touches[0].clientX);
    const onMouseMove = (e) => handleMove(e.clientX);
    const onEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onEnd);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onEnd);
    }
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
    };
  }, [isDragging, dragX]);

  return (
    <div ref={containerRef} className="relative w-72 h-14 bg-zinc-900 border border-zinc-700 rounded-full shadow-2xl overflow-hidden flex items-center select-none">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-50">
        <div className="text-zinc-400 text-xs font-bold tracking-[0.2em] uppercase animate-pulse flex items-center gap-2">
           Slide to Unlock <ChevronRight size={14} />
        </div>
      </div>
      <div 
        className="absolute left-1 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-10 cursor-grab active:cursor-grabbing"
        style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <Lock size={20} className="text-zinc-900" />
      </div>
    </div>
  );
};

// --- MAP COMPONENT ---
const GameMap = ({ myPos, participants, leaderPath, isLeafletLoaded, onMarkerClick, selectedUser, isLocked, onMapMove, focusTrigger }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({ markers: {}, trailGroup: null }); 

  useEffect(() => {
    if (!isLeafletLoaded || !mapRef.current || mapInstanceRef.current || !window.L) return;

    const map = window.L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.1,
    }).setView([myPos.lat, myPos.lng], 15);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(map);

    map.on('dragstart', () => {
      onMapMove();
    });

    layersRef.current.trailGroup = window.L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
  }, [isLeafletLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;
    const layers = layersRef.current;

    if (layers.trailGroup) {
      layers.trailGroup.clearLayers(); 
      
      if (leaderPath && leaderPath.length > 1) {
        let currentSegment = [leaderPath[0]];
        for (let i = 1; i < leaderPath.length; i++) {
          const prev = leaderPath[i-1];
          const curr = leaderPath[i];
          const dist = getDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng);

          if (dist > 1.0) {
             if (currentSegment.length > 1) {
               window.L.polyline(currentSegment, {
                 color: '#a855f7',
                 weight: 4,
                 opacity: 0.8,
                 dashArray: '5, 10',
                 lineCap: 'round'
               }).addTo(layers.trailGroup);
             }
             currentSegment = [curr];
          } else {
             currentSegment.push(curr);
          }
        }
        if (currentSegment.length > 1) {
           window.L.polyline(currentSegment, {
             color: '#a855f7',
             weight: 4,
             opacity: 0.8,
             dashArray: '5, 10',
             lineCap: 'round'
           }).addTo(layers.trailGroup);
        }
      }
    }

    participants.forEach(p => {
      if (!p.lat || !p.lng) return;

      if (!layers.markers[p.id]) {
        const html = `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="
              width: ${p.isLeader ? '24px' : '18px'};
              height: ${p.isLeader ? '24px' : '18px'};
              background-color: ${p.color};
              border: 2px solid white;
              box-shadow: 0 0 15px ${p.color};
              transform: rotate(45deg);
              margin-bottom: 4px;
            "></div>
            <span style="
              font-family: sans-serif; font-size: 10px; font-weight: bold;
              color: ${p.color}; text-shadow: 0 1px 2px black;
              background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px;
            ">${p.name}</span>
          </div>
        `;
        const icon = window.L.divIcon({ className: '', html, iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = window.L.marker([p.lat, p.lng], { icon }).addTo(map);
        marker.on('click', () => onMarkerClick(p));
        layers.markers[p.id] = marker;
      } else {
        layers.markers[p.id].setLatLng([p.lat, p.lng]);
      }
    });

    Object.keys(layers.markers).forEach(id => {
      if (!participants.find(p => p.id === id)) {
        layers.markers[id].remove();
        delete layers.markers[id];
      }
    });
  }, [participants, leaderPath, onMarkerClick]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !selectedUser) return;
    const map = mapInstanceRef.current;
    const bounds = window.L.latLngBounds([
        [myPos.lat, myPos.lng],
        [selectedUser.lat, selectedUser.lng]
    ]);
    
    map.fitBounds(bounds, { 
      paddingTopLeft: [40, 180], 
      paddingBottomRight: [40, 220], 
      animate: true 
    });
  }, [selectedUser]); 

  // Handle Auto-Follow Me
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !isLocked || selectedUser) return;
    const map = mapInstanceRef.current;
    const mapCenter = [myPos.lat, myPos.lng];
    map.panTo(mapCenter, { animate: true, duration: 1.0 });
  }, [myPos, selectedUser, isLocked]);

  // Handle Focus Trigger (Locate Button Click)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || focusTrigger === 0) return;
    const map = mapInstanceRef.current;
    map.flyTo([myPos.lat, myPos.lng], 18, { animate: true, duration: 1.5 });
  }, [focusTrigger]);

  return <div ref={mapRef} className="w-full h-full bg-zinc-950" />;
};

// --- MAIN APP ---
export default function App() {
  const [step, setStep] = useState('login'); 
  const [userName, setUserName] = useState(localStorage.getItem('convoy_name') || '');
  const [userColor, setUserColor] = useState(CAR_COLORS[0].hex);
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLocked, setIsLocked] = useState(true); 
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [isUiLocked, setIsUiLocked] = useState(false);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStartCity, setSimStartCity] = useState('Jaipur');
  const [simEndCity, setSimEndCity] = useState('Sikar');
  const [simRoute, setSimRoute] = useState([]); 
  const [simIndex, setSimIndex] = useState(0);

  const [myPos, setMyPos] = useState({ lat: 26.9124, lng: 75.7873 });
  const [participants, setParticipants] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [userId, setUserId] = useState(localStorage.getItem('convoy_uid') || `user_${Math.random().toString(36).substr(2, 9)}`);
  
  const lastPathPointRef = useRef(null);
  const lastUploadRef = useRef(0);
  const lastUploadedPosRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('convoy_uid', userId);
    if (window.L) { setIsLeafletLoaded(true); return; }
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = () => setIsLeafletLoaded(true);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.append(l, s);
  }, []);

  const fetchSimulationRoute = async (start, end) => {
    setStatusMsg("Fetching route...");
    try {
      const startRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${start}`);
      const startData = await startRes.json();
      if (!startData[0]) throw new Error("Start city not found");

      const endRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${end}`);
      const endData = await endRes.json();
      if (!endData[0]) throw new Error("End city not found");

      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startData[0].lon},${startData[0].lat};${endData[0].lon},${endData[0].lat}?overview=full&geometries=geojson`);
      const routeJson = await routeRes.json();
      
      if (routeJson.routes && routeJson.routes[0]) {
        const coords = routeJson.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
        setSimRoute(coords);
        setMyPos(coords[0]);
        return true;
      }
    } catch (e) {
      alert("Simulation Error: " + e.message);
      return false;
    }
    return false;
  };

  const joinRoom = async (code, host = false) => {
    if (!userName) return alert("Name required!");
    if (!db) return alert("Firebase not configured!");
    
    // Reset path tracker
    if (host) lastPathPointRef.current = null;
    lastUploadRef.current = 0;
    lastUploadedPosRef.current = null;

    const usersRef = collection(db, `sessions/${code}/users`);
    const snapshot = await getDocs(usersRef);
    const takenColors = snapshot.docs.map(doc => doc.data().color);
    
    if (!host && snapshot.empty) {
      return alert("Room not found! Please check the code or host a new one.");
    }

    if (snapshot.size >= 10) {
      return alert("Room is full! (Max 10 users)");
    }

    let finalColor = userColor;
    if (takenColors.includes(userColor)) {
      const availableColor = CAR_COLORS.find(c => !takenColors.includes(c.hex));
      if (availableColor) finalColor = availableColor.hex;
    }
    
    localStorage.setItem('convoy_name', userName);
    setSessionCode(code);
    setIsHost(host);
    setStep('map');

    if (host && isSimulating) {
      const success = await fetchSimulationRoute(simStartCity, simEndCity);
      if (!success) setIsSimulating(false); 
    }

    const userRef = doc(db, `sessions/${code}/users/${userId}`);
    await setDoc(userRef, {
      id: userId,
      name: userName,
      color: finalColor,
      isLeader: host,
      lat: myPos.lat,
      lng: myPos.lng,
      lastActive: serverTimestamp(),
      path: host ? [] : null
    });

    onSnapshot(usersRef, (snapshot) => {
      const activeUsers = [];
      snapshot.forEach(doc => activeUsers.push(doc.data()));
      setParticipants(activeUsers);
    });
  };

  const leaveSession = async () => {
    if (!db) return;

    if (isHost) {
      if (!window.confirm("Close Session? This will delete all trip data.")) return;
    }

    try {
      await deleteDoc(doc(db, `sessions/${sessionCode}/users/${userId}`));
      const remainingSnapshot = await getDocs(collection(db, `sessions/${sessionCode}/users`));

      if (isHost || remainingSnapshot.empty) {
        const batch = writeBatch(db);
        remainingSnapshot.forEach(doc => batch.delete(doc.ref));
        batch.delete(doc(db, "sessions", sessionCode));
        await batch.commit();
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }

    window.location.reload();
  };

  const clearTrail = async () => {
    if (!db || !isHost) return;
    if (window.confirm("Clear the recorded path trail? This helps if you took a wrong turn.")) {
       try {
         await updateDoc(doc(db, `sessions/${sessionCode}/users/${userId}`), {
           path: [] 
         });
         lastPathPointRef.current = null;
       } catch (e) {
         console.error("Error clearing trail", e);
       }
    }
  };

  useEffect(() => {
    if (step !== 'map' || !db) return;
    let watchId;
    let simInterval;

    if (isSimulating && isHost && simRoute.length > 0) {
      simInterval = setInterval(() => {
        setSimIndex(prev => {
          const nextIndex = prev + 1;
          if (nextIndex >= simRoute.length) { clearInterval(simInterval); return prev; }
          const nextPos = simRoute[nextIndex];
          setMyPos(nextPos);
          
          const payload = {
            lat: nextPos.lat, lng: nextPos.lng,
            lastActive: serverTimestamp()
          };

          const lastPoint = lastPathPointRef.current;
          const dist = lastPoint ? getDistanceKm(lastPoint.lat, lastPoint.lng, nextPos.lat, nextPos.lng) : 100;
          
          if (dist > 0.03) {
             payload.path = arrayUnion({lat: nextPos.lat, lng: nextPos.lng});
             lastPathPointRef.current = nextPos;
          }

          updateDoc(doc(db, `sessions/${sessionCode}/users/${userId}`), payload).catch(() => {});

          const lag1 = Math.max(0, nextIndex - 15);
          const pos1 = simRoute[lag1];
          if (pos1 && nextIndex > 15) {
             setDoc(doc(db, `sessions/${sessionCode}/users/bot_viper`), {
                id: 'bot_viper', name: 'Viper (AI)', color: '#ec4899', isLeader: false,
                lat: pos1.lat, lng: pos1.lng, lastActive: serverTimestamp()
             });
          }
          return nextIndex;
        });
      }, 1000); 
    } else {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, speed, accuracy } = pos.coords;
          setMyPos({ lat: latitude, lng: longitude });
          const now = Date.now();
          const timeDiff = now - lastUploadRef.current;
          const distMoved = lastUploadedPosRef.current 
            ? getDistanceKm(lastUploadedPosRef.current.lat, lastUploadedPosRef.current.lng, latitude, longitude)
            : 100;

          let shouldUpload = false;
          const isMovingFast = speed && speed > 8; 

          if (isMovingFast) {
             if (timeDiff > 5000 || distMoved > 0.05) shouldUpload = true;
          } else {
             if (timeDiff > 10000 || distMoved > 0.03) shouldUpload = true;
          }
          
          if (timeDiff > 60000) shouldUpload = true;

          if (shouldUpload) {
              const payload = { lat: latitude, lng: longitude, lastActive: serverTimestamp() };
              
              if (isHost) {
                 const lastPathPoint = lastPathPointRef.current;
                 const distFromPath = lastPathPoint ? getDistanceKm(lastPathPoint.lat, lastPathPoint.lng, latitude, longitude) : 100;
                 
                 // FILTER: Only add to trail if accuracy is good (< 20m) AND moved enough (> 30m)
                 if (distFromPath > 0.03 && accuracy < 20) { 
                     payload.path = arrayUnion({ lat: latitude, lng: longitude });
                     lastPathPointRef.current = { lat: latitude, lng: longitude };
                 }
              }

              updateDoc(doc(db, `sessions/${sessionCode}/users/${userId}`), payload)
                .then(() => {
                    lastUploadRef.current = now;
                    lastUploadedPosRef.current = { lat: latitude, lng: longitude };
                })
                .catch(() => {});
          }
        },
        (err) => setStatusMsg("GPS Error: " + err.message),
        { enableHighAccuracy: true, distanceFilter: 5 }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); if (simInterval) clearInterval(simInterval); };
  }, [step, sessionCode, isSimulating, isHost, simRoute]);

  const leader = useMemo(() => participants.find(p => p.isLeader), [participants]);
  const leaderPath = leader?.path || [];

  const handleMarkerClick = (user) => {
    if (user.id === userId) return;
    const dist = getDistanceKm(myPos.lat, myPos.lng, user.lat, user.lng);
    setSelectedUser({ ...user, distance: dist.toFixed(2) });
    setIsLocked(false); 
  };

  const sortedParticipants = useMemo(() => {
     if (!leader) return participants;
     const others = participants.filter(p => !p.isLeader).sort((a, b) => {
        const distA = getDistanceKm(leader.lat, leader.lng, a.lat, a.lng);
        const distB = getDistanceKm(leader.lat, leader.lng, b.lat, b.lng);
        return distA - distB;
     });
     return [leader, ...others];
  }, [participants, leader]);

  if (step === 'login') {
    return (
      <div className="fixed inset-0 bg-zinc-950 text-white overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center p-6 pt-20">
          <div className="max-w-md mx-auto w-full space-y-6">
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight">CONVOY</h1>
              <p className="text-blue-500 font-bold tracking-widest text-xs uppercase mt-1">Cloud Edition V4.5</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Callsign</label>
                <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Maverick" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-bold outline-none focus:border-blue-600" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {CAR_COLORS.map(c => (
                  <button key={c.hex} onClick={() => setUserColor(c.hex)} className={`h-10 rounded-lg transition-all ${userColor === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-80'}`} style={{ backgroundColor: c.hex }} />
                ))}
              </div>
              
              <div className="grid grid-cols-1 gap-3 pt-2">
                <button onClick={() => joinRoom(generateSessionId(), true)} className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold flex justify-center gap-2"><Zap size={20} /> HOST ROOM</button>
                <div className="flex gap-2">
                  <input value={sessionCode} onChange={e => setSessionCode(e.target.value.toUpperCase())} placeholder="CODE" className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center text-white outline-none w-full font-mono uppercase" />
                  <button onClick={() => joinRoom(sessionCode, false)} className="bg-zinc-800 text-white p-4 rounded-xl"><ArrowRight size={24} /></button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
               <button onClick={() => setIsSimulating(!isSimulating)} className="text-zinc-700 text-xs font-bold uppercase hover:text-zinc-500 transition-colors flex items-center gap-2">
                  <Settings size={12} /> {isSimulating ? 'Disable Simulation' : 'Enable Simulation'}
               </button>
               {isSimulating && (
                  <div className="mt-4 w-full bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                      <div className="flex gap-2">
                          <input value={simStartCity} onChange={e => setSimStartCity(e.target.value)} className="w-1/2 bg-zinc-800 rounded-lg p-2 text-xs text-white" placeholder="Start" />
                          <ArrowRight size={16} className="text-zinc-600 mt-2" />
                          <input value={simEndCity} onChange={e => setSimEndCity(e.target.value)} className="w-1/2 bg-zinc-800 rounded-lg p-2 text-xs text-white" placeholder="End" />
                      </div>
                  </div>
               )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-zinc-950 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <GameMap 
          myPos={myPos} 
          participants={participants} 
          leaderPath={leaderPath} 
          isLeafletLoaded={isLeafletLoaded} 
          onMarkerClick={handleMarkerClick} 
          selectedUser={selectedUser} 
          isLocked={isLocked}
          onMapMove={() => {
            setIsLocked(false);
            setSelectedUser(null);
          }}
          focusTrigger={focusTrigger}
        />
      </div>

      {/* --- TOUCH BLOCKER OVERLAY --- */}
      {isUiLocked && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="flex flex-col items-center gap-6 p-6">
              <div className="bg-zinc-800/50 p-4 rounded-full border border-white/10 shadow-2xl">
                 <ShieldCheck size={48} className="text-emerald-500" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-white tracking-wider">UI LOCKED</h2>
                <p className="text-zinc-400 text-sm font-medium">Touch interactions disabled</p>
              </div>
              
              {/* Swipe Component */}
              <SwipeToUnlock onUnlock={() => setIsUiLocked(false)} />
           </div>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex flex-col items-center pointer-events-none space-y-4">
        <div className="w-full flex justify-between pointer-events-auto">
          <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl p-3 shadow-xl">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Session</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono font-bold text-xl">{sessionCode}</span>
              <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="text-zinc-500"><Share2 size={14} /></button>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isHost && (
              <button onClick={clearTrail} className="bg-zinc-800 text-amber-400 p-3 rounded-xl shadow-xl hover:bg-zinc-700 transition-colors">
                <Eraser size={20} />
              </button>
            )}
            <button onClick={leaveSession} className={`${isHost ? 'bg-red-600 text-white' : 'bg-zinc-800 text-red-400'} p-3 rounded-xl shadow-xl`}>
                {isHost ? <Trash2 size={20} /> : <LogOut size={20} />}
            </button>
          </div>
        </div>

        {selectedUser && (
          <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700 p-4 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto animate-in slide-in-from-top-4 duration-300">
            <div style={{ backgroundColor: selectedUser.color }} className="w-1 h-10 rounded-full"></div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Distance to {selectedUser.name}</div>
              <div className="text-2xl font-mono font-black text-white">{selectedUser.distance}<span className="text-sm text-zinc-400 ml-1">km</span></div>
            </div>
            <button onClick={() => setSelectedUser(null)} className="ml-4 p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 z-10 pointer-events-none">
        <div className="bg-zinc-900/95 backdrop-blur border-t border-zinc-800 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-white font-bold">{userName}</h3>
              <p className="text-zinc-500 text-xs">
                 {participants.length} Active • {isSimulating ? 'Simulation' : 'GPS Active'}
                 {!isSimulating && <span className="text-green-500 ml-1 flex items-center inline-flex gap-1"><BatteryCharging size={10} /> Eco</span>}
              </p>
            </div>
            <div className="flex gap-2">
                {/* --- UI LOCK BUTTON --- */}
                <button 
                   onClick={() => setIsUiLocked(true)}
                   className="p-3 rounded-xl shadow-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                   title="Lock Screen"
                >
                   <Shield size={20} />
                </button>

                <button onClick={() => { setIsLocked(!isLocked); setSelectedUser(null); }} className={`p-3 rounded-xl shadow-lg transition-colors ${isLocked ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                    {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                </button>
                <button onClick={() => { 
                    setIsLocked(true); 
                    setSelectedUser(null); 
                    setFocusTrigger(prev => prev + 1);
                }} className="bg-zinc-800 text-white p-3 rounded-xl shadow-lg">
                    <Locate size={20} />
                </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
             {sortedParticipants.map(p => (
                <div key={p.id} className="flex-shrink-0 bg-zinc-950 border border-zinc-800 rounded-lg p-2 px-3 flex items-center gap-2 active:scale-95 transition-transform" onClick={() => handleMarkerClick(p)}>
                   <div style={{ backgroundColor: p.color }} className="w-3 h-3 rounded-sm"></div>
                   <span className="text-zinc-300 text-xs">{p.name} {p.isLeader && '👑'}</span>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}