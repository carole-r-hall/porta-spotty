import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Fix default Leaflet marker icons in Vite/React
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MSP_CENTER = [44.9778, -93.265]; // fallback center

function RecenterOnUser({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 14);
    }
  }, [position, map]);
  return null;
}

// Component that listens for clicks on the map and notifies parent
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

function App() {
  const [toilets, setToilets] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [error, setError] = useState(null);

  // State for adding a new toilet via map click
  const [pendingLocation, setPendingLocation] = useState(null); // { lat, lng } or null
  const [newName, setNewName] = useState("");
  const [newIsFree, setNewIsFree] = useState(true);
  const [newRunningWater, setNewRunningWater] = useState(true);
  const [newOpenInWinter, setNewOpenInWinter] = useState(true);
  const [newGenderNeutral, setNewGenderNeutral] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Get user location and initial toilets
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not available in this browser.");
      setUserPos(MSP_CENTER);
      fetchToilets(MSP_CENTER[0], MSP_CENTER[1]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const position = [latitude, longitude];
        setUserPos(position);
        fetchToilets(latitude, longitude);
      },
      (err) => {
        console.error(err);
        setError("Could not get your location; using downtown Minneapolis.");
        setUserPos(MSP_CENTER);
        fetchToilets(MSP_CENTER[0], MSP_CENTER[1]);
      }
    );
  }, []);

  function fetchToilets(lat, lng) {
    fetch(
      `http://127.0.0.1:8000/toilets?lat=${lat}&lng=${lng}&radius_km=3`
    )
      .then((res) => res.json())
      .then((data) => setToilets(data))
      .catch((err) => setError("Error fetching toilets: " + err.message));
  }

  const center = userPos || MSP_CENTER;

  // When user clicks on the map, record that location for a new toilet
  function handleMapClick(latlng) {
    setPendingLocation(latlng);
    setNewName("");
    setNewIsFree(true);
    setNewRunningWater(true);
    setNewOpenInWinter(true);
    setNewGenderNeutral(true);
  }

  async function handleSubmitNewToilet(e) {
    e.preventDefault();
    if (!pendingLocation || !newName.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/toilets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          latitude: pendingLocation.lat,
          longitude: pendingLocation.lng,
          is_free: newIsFree,
          running_water: newRunningWater,
          open_in_winter: newOpenInWinter,
          gender_neutral: newGenderNeutral,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to create toilet");
      }

      const created = await response.json();
      // Add new toilet to list
      setToilets((prev) => [...prev, created]);
      // Clear pending state
      setPendingLocation(null);
      setNewName("");
    } catch (err) {
      console.error(err);
      setError("Error creating toilet: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelNew() {
    setPendingLocation(null);
    setNewName("");
  }

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          background: "white",
          padding: "0.5rem 1rem",
          margin: "0.5rem",
          borderRadius: "999px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <strong>Porta-Spotty</strong>{" "}
        <span style={{ fontSize: "0.9rem" }}>
          {userPos ? "Click the map to add a restroom" : "Finding your location..."}
        </span>
        {error && (
          <div
            style={{
              color: "red",
              fontSize: "0.8rem",
              marginTop: "0.25rem",
              maxWidth: "280px",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* New toilet mini-form overlay (bottom-left) */}
      {pendingLocation && (
        <div
          style={{
            position: "absolute",
            zIndex: 1000,
            left: "0.5rem",
            bottom: "0.5rem",
            background: "white",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            maxWidth: "320px",
            fontSize: "0.9rem",
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Add restroom here</strong>
            <div style={{ fontSize: "0.75rem", color: "#555" }}>
              Lat: {pendingLocation.lat.toFixed(5)}, Lng:{" "}
              {pendingLocation.lng.toFixed(5)}
            </div>
          </div>
          <form onSubmit={handleSubmitNewToilet}>
            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Name:
                <br />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Lake Harriet Bandshell restroom"
                  style={{
                    width: "100%",
                    padding: "0.25rem 0.4rem",
                    marginTop: "0.1rem",
                  }}
                  required
                />
              </label>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <label>
                <input
                  type="checkbox"
                  checked={newIsFree}
                  onChange={(e) => setNewIsFree(e.target.checked)}
                  style={{ marginRight: "0.25rem" }}
                />
                Free to use
              </label>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <label>
                <input
                  type="checkbox"
                  checked={newRunningWater}
                  onChange={(e) => setNewRunningWater(e.target.checked)}
                  style={{ marginRight: "0.25rem" }}
                />
                Running water
              </label>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <label>
                <input
                  type="checkbox"
                  checked={newOpenInWinter}
                  onChange={(e) => setNewOpenInWinter(e.target.checked)}
                  style={{ marginRight: "0.25rem" }}
                />
                Open in winter
              </label>
            </div>
            <div style={{ marginBottom: "0.25rem" }}>
              <label>
                <input
                  type="checkbox"
                  checked={newGenderNeutral}
                  onChange={(e) => setNewGenderNeutral(e.target.checked)}
                  style={{ marginRight: "0.25rem" }}
                />
                Gender neutral
              </label>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                style={{
                  flex: 1,
                  padding: "0.3rem 0.5rem",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: submitting ? "#888" : "#0b7285",
                  color: "white",
                  cursor: submitting ? "default" : "pointer",
                }}
              >
                {submitting ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelNew}
                style={{
                  flex: 1,
                  padding: "0.3rem 0.5rem",
                  borderRadius: "999px",
                  border: "1px solid #ccc",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterOnUser position={userPos} />

        {/* Click handler */}
        <MapClickHandler onClick={handleMapClick} />

        {/* User position marker */}
        {userPos && (
          <Marker position={userPos}>
            <Popup>You are here (approx).</Popup>
          </Marker>
        )}

        {/* Pending new toilet marker */}
        {pendingLocation && (
          <Marker position={[pendingLocation.lat, pendingLocation.lng]}>
            <Popup>New restroom location</Popup>
          </Marker>
        )}

        {/* Existing toilets */}
        {toilets.map((t) => (
          <Marker key={t.id} position={[t.latitude, t.longitude]}>
            <Popup>
              <strong>{t.name}</strong>
              <br />
              Cleanliness:{" "}
              {t.avg_cleanliness ? t.avg_cleanliness.toFixed(1) : "No ratings yet"}
              <br />
              {t.is_free ? "Free" : "May require purchase/fee"}
              <br />
              {t.running_water && "Running water"}
              <br />
              {t.open_in_winter !== null && t.open_in_winter !== undefined && (
                <>
                  {t.open_in_winter ? "Open in winter" : "Closed in winter"}
                  <br />
                </>
              )}
              {t.gender_neutral && "Gender neutral"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;