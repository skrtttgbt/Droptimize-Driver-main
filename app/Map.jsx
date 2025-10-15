import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import haversine from "haversine-distance";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { auth, db } from "../firebaseConfig";

const GOOGLE_MAPS_APIKEY = "YOUR_GOOGLE_MAPS_API_KEY"; // Replace this

export default function Map({ user: passedUser }) {
  const [user, setUser] = useState(passedUser || null);
  const [userData, setUserData] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slowdowns, setSlowdowns] = useState([]);
  const [speedLimit, setSpeedLimit] = useState(0);
  const [vehicleSpeed, setVehicleSpeed] = useState(0);
  const [mode, setMode] = useState("driving"); // 🚦 driving | routing
  const locationSubscription = useRef(null);

  const DEFAULT_RADIUS = 15;
  const OVERPASS_RADIUS = 1000;

  const CATEGORY_COLORS = {
    Crosswalk: "#00bfff",
    School: "#ff9800",
    Church: "#9c27b0",
    Curve: "#4caf50",
    Slippery: "#f44336",
    Default: "#9e9e9e",
  };

  // 🔹 Watch authentication
  useEffect(() => {
    if (!user) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) setUser(firebaseUser);
      });
      return unsubscribe;
    }
  }, []);

  // 🔹 Fetch slowdown data from Firestore branch
  const loadBranchSlowdowns = async (branchId) => {
    try {
      const branchRef = doc(db, "branches", branchId);
      const branchSnap = await getDoc(branchRef);
      if (!branchSnap.exists()) return [];

      const branchData = branchSnap.data();
      if (!branchData.slowdowns || !Array.isArray(branchData.slowdowns)) return [];

      return branchData.slowdowns.map((s, i) => ({
        id: i,
        category: s.category || "Default",
        location: s.location,
        radius: s.radius || DEFAULT_RADIUS,
        speedLimit: s.speedLimit || 0,
        createdAt: s.createdAt || Date.now(),
      }));
    } catch {
      return [];
    }
  };

  // 🔹 Optionally fetch nearby crosswalks from OpenStreetMap
  const loadOverpassCrosswalks = async (lat, lon) => {
    try {
      const query = `
        [out:json][timeout:25];
        (node["highway"="crossing"](around:${OVERPASS_RADIUS},${lat},${lon}););
        out body;
      `;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url);
      const data = await res.json();

      return data.elements.map((el) => ({
        category: "Crosswalk",
        location: { lat: el.lat, lng: el.lon },
        radius: DEFAULT_RADIUS,
        speedLimit: 20,
      }));
    } catch {
      return [];
    }
  };

  // 🔹 Load user info and slowdown areas
  const loadSlowdowns = async (coords) => {
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userDataFetched = userSnap.data();
      setUserData(userDataFetched);

      const branchId = userDataFetched.branchId;
      let allSlowdowns = [];

      if (branchId) {
        const branchSlowdowns = await loadBranchSlowdowns(branchId);
        allSlowdowns = [...allSlowdowns, ...branchSlowdowns];
      }

      if (coords) {
        const crosswalks = await loadOverpassCrosswalks(
          coords.latitude,
          coords.longitude
        );
        allSlowdowns = [...allSlowdowns, ...crosswalks];
      }

      setSlowdowns(allSlowdowns);
    } catch {
      console.log("Error loading slowdowns");
    }
  };

  // 🔹 Location watcher
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLoading(false);
          return;
        }

        const initial = await Location.getCurrentPositionAsync({});
        await loadSlowdowns(initial.coords);

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (position) => {
            const coords = position.coords;
            setLocation(coords);
            setLoading(false);

            const speedKmh = coords.speed ? coords.speed * 3.6 : 0;
            setVehicleSpeed(Math.round(speedKmh));

            let nearestLimit = 0;
            slowdowns.forEach((s) => {
              const dist = haversine(coords, s.location);
              if (dist < (s.radius ?? DEFAULT_RADIUS)) {
                nearestLimit = s.speedLimit;
              }
            });

            setSpeedLimit(nearestLimit);
          }
        );
      } catch {
        setLoading(false);
      }
    })();

    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
    };
  }, [user, slowdowns]);

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00b2e1" />
        <Text style={{ marginTop: 10 }}>Getting current location...</Text>
      </View>
    );

  if (!location)
    return (
      <View style={styles.loadingContainer}>
        <Text>Location unavailable. Please enable GPS.</Text>
      </View>
    );

  const isOverspeeding = speedLimit > 0 && vehicleSpeed > speedLimit;

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        followsUserLocation
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* 🔹 Show all slowdown areas */}
        {slowdowns.map((s, i) => (
          <Circle
            key={i}
            center={{
              latitude: s.location.lat,
              longitude: s.location.lng,
            }}
            radius={s.radius || DEFAULT_RADIUS}
            strokeColor={CATEGORY_COLORS[s.category] || CATEGORY_COLORS.Default}
            fillColor={`${CATEGORY_COLORS[s.category] || CATEGORY_COLORS.Default}55`}
            strokeWidth={2}
          />
        ))}

        {/* 🔹 Show destination if delivering */}
        {userData?.status === "Delivering" && userData?.destination && (
          <>
            <Marker
              coordinate={{
                latitude: userData.destination.lat,
                longitude: userData.destination.lng,
              }}
              title="Delivery Destination"
              pinColor="orange"
            />

            {/* Draw route only if in routing mode */}
            {mode === "routing" && (
              <MapViewDirections
                origin={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                destination={{
                  latitude: userData.destination.lat,
                  longitude: userData.destination.lng,
                }}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={5}
                strokeColor="#00b2e1"
                lineDashPattern={[0]}
              />
            )}
          </>
        )}
      </MapView>

      {/* 🔹 Driving / Routing Mode Toggle */}
      {userData?.status === "Delivering" && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === "driving" && styles.toggleActive,
            ]}
            onPress={() => setMode("driving")}
          >
            <Ionicons name="car" size={18} color={mode === "driving" ? "#fff" : "#333"} />
            <Text
              style={[
                styles.toggleText,
                { color: mode === "driving" ? "#fff" : "#333" },
              ]}
            >
              Driving
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === "routing" && styles.toggleActive,
            ]}
            onPress={() => setMode("routing")}
          >
            <Ionicons name="map" size={18} color={mode === "routing" ? "#fff" : "#333"} />
            <Text
              style={[
                styles.toggleText,
                { color: mode === "routing" ? "#fff" : "#333" },
              ]}
            >
              Routing
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 🔹 Speed Info Panel */}
      <View style={styles.infoPanel}>
        <View style={styles.row}>
          <View style={styles.speedCard}>
            <Text style={styles.label}>Speed Limit</Text>
            <Text style={[styles.speedValue, { color: "#29bf12" }]}>
              {speedLimit > 0 ? speedLimit : "No limit"}
            </Text>
            {speedLimit > 0 && <Text style={styles.unit}>km/h</Text>}
          </View>

          <View style={styles.speedCard}>
            <Text style={styles.label}>Vehicle Speed</Text>
            <Text
              style={[
                styles.speedValue,
                { color: isOverspeeding ? "#f21b3f" : "#29bf12" },
              ]}
            >
              {vehicleSpeed}
            </Text>
            <Text style={styles.unit}>km/h</Text>
          </View>
        </View>

        {isOverspeeding && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={20} color="#f21b3f" />
            <Text style={styles.warningText}>You are overspeeding!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoPanel: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  speedCard: { flex: 1, alignItems: "center" },
  label: { fontSize: 14, color: "#777", marginBottom: 4 },
  speedValue: { fontSize: 32, fontWeight: "bold" },
  unit: { fontSize: 12, color: "#555" },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffe6e6",
    paddingVertical: 8,
    borderRadius: 12,
  },
  warningText: {
    color: "#f21b3f",
    fontWeight: "600",
    fontSize: 14,
  },
  toggleContainer: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  toggleActive: {
    backgroundColor: "#00b2e1",
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
  },
});
