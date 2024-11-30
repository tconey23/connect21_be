import cron from 'node-cron'
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import serviceAccount from './connect21-d0acd-firebase-adminsdk-zit5f-a090868497.json' assert { type: 'json' };
import axios from 'axios';


dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://connect21-d0acd-default-rtdb.firebaseio.com" // Replace with your correct database URL
});

const db = admin.database(); // Firebase Realtime Database instance
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json()); // To parse JSON request bodies

app.get('/api/categories', async (req, res) => {
  try {
    const ref = db.ref('categories'); 
    const snapshot = await ref.once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No categories found' });
    }

    return res.status(200).json(snapshot.val());
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});