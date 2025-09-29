import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export default function Map() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock data
  const speedLimit = 60;
  const vehicleSpeed = 75;
  const nextParcel = "123 Sampaguita St, Quezon City";

  const isOverspeeding = vehicleSpeed > speedLimit;

  useEffect(() => {
    (async () => {
      // Ask for location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to show your current location."
        );
        setLoading(false);
        return;
      }

      // Get current location
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setLocation(current.coords);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00b2e1" />
        <Text style={{ marginTop: 10 }}>Getting current location...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Location unavailable. Please enable GPS.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Google Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You are here"
          pinColor="#00b2e1"
        />
      </MapView>
          
      {/* Floating Info Panel */}
      <View style={styles.infoPanel}>
        {/* Speed Section */}
        <View style={styles.row}>
          <View style={styles.speedCard}>
            <Text style={styles.label}>Speed Limit</Text>
            <Text style={[styles.speedValue, { color: "#29bf12" }]}>
              {speedLimit}
            </Text>
            <Text style={styles.unit}>km/h</Text>
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

        {/* Next Parcel Section */}
        <View style={styles.parcelCard}>
          <Ionicons name="location" size={18} color="#ff9914" />
          <Text numberOfLines={2} style={styles.parcelText}>
            {nextParcel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
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
  speedCard: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    color: "#777",
    marginBottom: 4,
  },
  speedValue: {
    fontSize: 32,
    fontWeight: "bold",
  },
  unit: {
    fontSize: 12,
    color: "#555",
  },
  parcelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 12,
  },
  parcelText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
});
