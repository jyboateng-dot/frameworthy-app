// Database Service Interface
// Using Firestore
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, updateDoc, doc, limit, startAfter } from 'firebase/firestore';

// An order carries two independent status fields — don't conflate them:
//
//   paymentStatus: 'pending' -> 'paid'
//     Whether money actually arrived. Written ONLY by the
//     verifyPaystackPayment Cloud Function after checking with Paystack
//     server-side (firestore.rules forbids clients from setting 'paid').
//     Set to 'pending' by CheckoutPage in the order payload.
//
//   status: 'pending' -> 'processing' -> 'shipped' -> 'delivered'
//     Fulfilment progress, advanced only by the admin dashboard. Set below.
//
// A just-paid order is therefore paymentStatus 'paid' + status 'pending'.
// Anything asking "has this been paid for?" must check paymentStatus;
// `status` alone never answers that.
export const createOrder = async (orderData) => {
    console.log('Creates real Firestore order:', orderData);
    try {
        const docRef = await addDoc(collection(db, "orders"), {
            ...orderData,
            createdAt: serverTimestamp(),
            status: 'pending'
        });
        return { id: docRef.id, status: 'pending' };
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
};

const ORDERS_PAGE_SIZE = 100;

// Paginated — this previously fetched every order ever created (including
// full items arrays) on every admin dashboard load, unbounded and growing
// with store history. Returns a page plus a cursor (the last doc snapshot)
// for the caller to request the next page with, and hasMore so the UI knows
// whether a "Load more" affordance is warranted.
export const getOrders = async (afterDoc = null) => {
    try {
        const constraints = [collection(db, "orders"), orderBy("createdAt", "desc")];
        if (afterDoc) constraints.push(startAfter(afterDoc));
        constraints.push(limit(ORDERS_PAGE_SIZE + 1));
        const q = query(...constraints);
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs;
        const hasMore = docs.length > ORDERS_PAGE_SIZE;
        const pageDocs = hasMore ? docs.slice(0, ORDERS_PAGE_SIZE) : docs;
        const orders = pageDocs.map((d) => ({ id: d.id, ...d.data() }));
        const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
        return { orders, lastDoc, hasMore };
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
