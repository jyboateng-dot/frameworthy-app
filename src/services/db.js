// Database Service Interface
// Using Firestore
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';

export const createOrder = async (orderData) => {
    console.log('Creates real Firestore order:', orderData);
    try {
        const docRef = await addDoc(collection(db, "orders"), {
            ...orderData,
            createdAt: serverTimestamp(),
            status: 'pending' // pending, paid, shipped
        });
        return { id: docRef.id, status: 'pending' };
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
};

export const getOrders = async () => {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    } catch (e) {
        console.error("Error fetching orders: ", e);
        throw e;
    }
};

export const getUserOrders = async (userId) => {
    try {
        const q = query(
            collection(db, "orders"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    } catch (e) {
        console.error("Error fetching user orders: ", e);
        throw e;
    }
};

export const getUserDeliveryAddresses = async (userId) => {
    try {
        const orders = await getUserOrders(userId);
        const addresses = [];
        const seen = new Set();
        
        for (const order of orders) {
            if (order.shippingAddress) {
                const { address, city, phone } = order.shippingAddress;
                const name = order.customerName || '';
                const key = `${name}|${phone}|${city}|${address}`.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    addresses.push({
                        id: order.id, // use order ID as a unique key for the address entry
                        fullName: name,
                        phoneNumber: phone,
                        city: city,
                        deliveryAddress: address
                    });
                }
            }
        }
        return addresses;
    } catch (e) {
        console.error("Error extracting user delivery addresses: ", e);
        return [];
    }
};

export const updateOrderStatus = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error updating order status: ", e);
        throw e;
    }
};

export const saveProject = async (projectData) => {
    console.log('Saving real Firestore project:', projectData);
    try {
        const docRef = await addDoc(collection(db, "projects"), {
            ...projectData,
            updatedAt: serverTimestamp()
        });
        return { id: docRef.id };
    } catch (e) {
        console.error("Error saving project: ", e);
        throw e;
    }
};
