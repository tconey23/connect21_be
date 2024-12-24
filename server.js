import { google } from 'googleapis';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const authenticateGoogleAPI = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, './firebasecredentials.json'),
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.group.member',
    ],
  });
  return auth.getClient();
};

const listGroups = async () => {
  try {
    const authClient = await authenticateGoogleAPI();
    const directory = google.admin({ version: 'directory_v1', auth: authClient });

    // Replace with your actual domain or customer ID
    const response = await directory.groups.list({
      domain: 'tomconey.dev',
    });

    console.log('Groups:', response.data.groups);
  } catch (error) {
    console.error('Error listing groups:', error.message);
  }
};
 
listGroups()

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

const getPromptsDate = async (date) => {
  const db = admin.database()

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(date))  

  try {
    const ref = db.ref(`categories/${formattedDate}`); // Reference the path with the date parameter
    const snapshot = await ref.once('value'); // Fetch data as a one-time operation
    if (snapshot.exists()) {
      console.log('Data fetched:', snapshot.val());
      return snapshot.val(); // Return the data
    } else {
      console.log('No data available');
      return null;
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

const addUser = async (user) => {
  console.clear();
  const db = admin.database(); 

  try {
    const ref = db.ref(`users/${user.uid}`); // Reference to the specific user
    const snapshot = await ref.once('value'); 

    if (snapshot.exists()) {
      return (`User with UID ${user.uid} already exists.`)
    } else {
      // Add new user
      const newUser = {
        email: user.email,
        name: user.displayName || 'Anonymous',
        history: {},
      };

      await ref.set(newUser);
      return (`User with UID ${user.uid} added successfully:`, newUser)
    }
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

app.get('/api/prompts/:dt', async (req, res) => {
  const date = req.params.dt;
  try {
   const returnedData = await getPromptsDate(new Date(date).toLocaleDateString())
   res.status(200).json(returnedData)
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: 'Internal server error' }); 
  }
});

app.get('/api/users', async(req, res) => {  
  const userData = await listAllUsers() 
  if(userData){
    console.log(userData)
    return res.status(200).json(userData) 
  }
})

app.get('/api/userData', async(req, res) => {  
  try {
    const ref = db.ref(`users`); 
    const snapshot = await ref.once('value'); 
    if (snapshot.exists()) {
      return res.status(200).json(snapshot.val()) 
    } else {
      console.log('No data available');
      return res.status(200).json('No data is available') 
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
})

app.post('/api/users/adduser', async(req, res) => {  
  let user = req.body
  if(user){
    console.log(user)
    try{
      const response = await addUser(user.user)
      console.log(response)
      res.status(200).json(response)
    } catch (err) {
      res.status(500).json(err)
    }
  }
})

app.get('/api/getdbpath', async (req, res) => {
  try {
    const path = req.query.path;
    if (!path) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    console.log('Requested path:', path);

    const ref = db.ref(path);
    const snapshot = await ref.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'No data found at the specified path' });
    }

    const data = snapshot.val();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching data from Firebase:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gamedata', async (req, res) => {
  const data = req.body; 
  console.log(data)
  const user = data.find(item => item.user)?.user; 
  const gameData = data.filter(item => !item.user); 

  const today = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date()).replace(/\//g, '-');

  if (!user || !user.name) {
    return res.status(400).json({ error: 'User information is required in the request.' });
  }

  const userPath = `users/${user.name}/saved_games/${today}/${Date.now()}`;

  try {
    const savedGameRef = db.ref(userPath);
    const snapshot = await savedGameRef.once('value');

    if (!snapshot.exists()) {
      await savedGameRef.set({ createdAt: Date.now(), gameData: {} });
    }

    const gameDataRef = savedGameRef.child('gameData');
    for (const item of gameData) {
      await gameDataRef.push(item);
    }

    res.status(200).json(`${userPath}`);
  } catch (err) {
    console.error('Error adding data to Firebase:', err);
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/users/createuser', async (req, res) => {
  const user = req.body;

  console.log(user)

  if (!user || !user.email || !user.password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Create a user in Firebase Authentication
    const newUser = await admin.auth().createUser({
      email: user.email,
      password: user.password,
      displayName: user.displayName || null,
      phoneNumber: user.phoneNumber || null,
    });

    // Optionally, you can also save additional user data to Firestore/Database
    const response = {
      uid: newUser.uid,
      email: newUser.email,
      displayName: newUser.displayName,
      phoneNumber: newUser.phoneNumber,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/', (req, res) => {
  res.status(200).json({ status: 'Server is healthy' });  
});

const addUserToGroup = async (groupEmail, userEmail) => {
  try {
    const authClient = await authenticateGoogleAPI();
    const admin = google.admin({ version: 'directory_v1', auth: authClient });

    // Insert a member into the group
    const response = await admin.members.insert({
      groupKey: groupEmail, // Group email
      requestBody: {
        email: userEmail, // User email to add
        role: 'MEMBER',   // Role: MEMBER | MANAGER | OWNER
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error adding user to group:', error.message);
    throw error;
  }
};

app.post('/api/v1/addtester/android', async (req, res) => {

  const { groupEmail, userEmail } = req.body;

  if (!groupEmail || !userEmail) {
    return res.status(400).json({ error: 'groupEmail and userEmail are required.' });
  }

  try {
    const result = await addUserToGroup(groupEmail, userEmail);
    res.status(200).json({ message: 'User added successfully', data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`); 
});

// 'https://secure-beach-74758-ab0619edd0f3.herokuapp.com/'  

 
