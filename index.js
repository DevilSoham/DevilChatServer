const admin = require("firebase-admin");
const express = require("express");
const app = express();

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const messaging = admin.messaging();

// Firestore listener for new messages
db.collectionGroup("messages").onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async change => {
    if (change.type === "added") {
      const messageData = change.doc.data();
      const chatPath = change.doc.ref.parent.parent.path; // chats/{chatId}
      const chatDoc = await db.doc(chatPath).get();
      const chat = chatDoc.data();

      if (!chat || !chat.users) return;
      const senderId = messageData.senderId;
      const recipientIds = chat.users.filter(uid => uid !== senderId);

      const tokens = [];
      for (const uid of recipientIds) {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists && userDoc.data().fcmToken) {
          tokens.push(userDoc.data().fcmToken);
        }
      }

      if (tokens.length > 0) {
        const payload = {
          notification: {
            title: messageData.senderName || "New message",
            body: messageData.text || "Sent a message",
          },
          data: {
            chatId: chatDoc.id,
            senderId: senderId,
          },
        };

        await messaging.sendToDevice(tokens, payload);
        console.log("✅ Notification sent to:", tokens);
      }
    }
  });
});

app.get("/", (req, res) => {
  res.send("🔥 Devil Chat Notification Server is live on Render!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
