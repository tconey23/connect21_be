import cron from 'node-cron'
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin'; 

const serviceAccount = await import('./firebasecredentials.json', {
  assert: { type: 'json' }
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount.default),
  databaseURL: "https://connect21-d0acd-default-rtdb.firebaseio.com",
});


dotenv.config(); 

const db = admin.database(); // Firebase Realtime Database instance 
const auth = admin.auth()
const app = express();
const PORT = process.env.PORT || 5001;

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

const listAllUsers = async (nextPageToken) => {
  let userArray = []
  try {
    const result = await auth.listUsers(1000, nextPageToken); // Fetch up to 1000 users
    result.users.forEach((user) => {
      userArray.push(user.toJSON());
    });

    // If there are more users, fetch the next page
    if (result.pageToken) {
      const users = await listAllUsers(result.pageToken);
      return users
    }

    return userArray
  } catch (error) {
    console.error('Error listing users:', error);
  }
};

app.get('/api/users', async(req, res) => {
  const userData = await listAllUsers()
  if(userData){
    console.log(userData)
    return res.status(200).json(userData)
  }
})

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is healthy' });
});



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

'https://secure-beach-74758-ab0619edd0f3.herokuapp.com/' 
