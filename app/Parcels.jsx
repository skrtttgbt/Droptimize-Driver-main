import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ParcelDetailsModal from "../components/ParcelDetailsModal";
import { auth, db } from "../firebaseConfig";
export default function Parcels() {
  const [selectedTab, setSelectedTab] = useState("toDeliver");
  const [parcels, setParcels] = useState([]);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const statusColors = {
    "To Deliver": "#ff9914",
    Delivered: "#29bf12",
    Failed: "#f21b3f",
    Cancelled: "#f21b3f",
  };


useEffect(() => {
  const fetchParcels = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return; 
      }

      const parcelsRef = collection(db, "parcels");
      const q = query(parcelsRef, where("driverUid", "==", user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log("No parcels found for this driver.");
        setParcels([]); 
      } else {
        const fetchedParcels = snapshot.docs.map((doc) => ({
          ParcelID: doc.id,
          ...doc.data(),
        }));
        setParcels(fetchedParcels);
      }
    } catch (error) {
      console.error("Error fetching parcels:", error);
      Alert.alert("Error", "An error occurred while fetching parcels. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  fetchParcels();
}, []);


  const handleUpdateStatus = (parcelId, newStatus) => {
    setParcels((prev) =>
      prev.map((p) =>
        p.ParcelID === parcelId ? { ...p, Status: newStatus } : p
      )
    );
  };


  const filteredParcels = parcels.filter((p) => {
    if (selectedTab === "toDeliver") {
      return p.Status === "To Deliver";
    } else {
      if (historyFilter === "All") {
        return ["Delivered", "Cancelled", "Failed"].includes(p.Status);
      }
      return p.Status === historyFilter;
    }
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#00b2e1" />
        <Text style={{ marginTop: 10 }}>Loading parcels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: selectedTab === "toDeliver" ? "#00b2e1" : "#e0e0e0" },
          ]}
          onPress={() => setSelectedTab("toDeliver")}
        >
          <Text
            style={{
              color: selectedTab === "toDeliver" ? "#fff" : "#0064b5",
              fontWeight: "bold",
            }}
          >
            To Deliver
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: selectedTab === "history" ? "#00b2e1" : "#e0e0e0" },
          ]}
          onPress={() => setSelectedTab("history")}
        >
          <Text
            style={{
              color: selectedTab === "history" ? "#fff" : "#0064b5",
              fontWeight: "bold",
            }}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* History Filter */}
      {selectedTab === "history" && (
        <View style={styles.filterContainer}>
          {["All", "Delivered", "Failed", "Cancelled"].map((status) => {
            const colors = {
              All: "#00b2e1",
              Delivered: "#29bf12",
              Failed: "#f21b3f",
              Cancelled: "#ff9914",
            };

            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      historyFilter === status ? colors[status] : "#f0f0f0",
                  },
                ]}
                onPress={() => setHistoryFilter(status)}
              >
                <Text
                  style={{
                    color: historyFilter === status ? "#fff" : "#0064b5",
                    fontWeight: "bold",
                  }}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Parcel List */}
      {filteredParcels.length === 0 ? (
        <Text style={{ textAlign: "center", marginTop: 20, color: "#777" }}>
          No parcels found.
        </Text>
      ) : (
        <FlatList
          data={filteredParcels}
          keyExtractor={(item) => item.ParcelID}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.parcelCard}
              onPress={() => setSelectedParcel(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.parcelName}>{item.Recipient}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[item.Status] || "#ccc" },
                  ]}
                >
                  <Text style={styles.statusText}>{item.Status}</Text>
                </View>
              </View>
              <Text style={styles.parcelText}>{item.FullAddress}</Text>
              <Text style={styles.parcelText}>{item.Contact}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal */}
      <ParcelDetailsModal
        visible={!!selectedParcel}
        parcel={selectedParcel}
        onClose={() => setSelectedParcel(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 10 },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  parcelCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  parcelName: { fontSize: 16, fontWeight: "bold" },
  parcelText: { fontSize: 14, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
});
