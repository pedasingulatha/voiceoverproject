const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const Fuse = require('fuse.js');
const { log } = require('console');


// Initialize express app
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

const usersFilePath = path.join(__dirname, 'data', 'users.json');

// Multer configuration for file upload
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadDir = './uploads';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir);
            }
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only Excel files are allowed.'));
        }
        cb(null, true);
    },
});

app.get('/', (req, res) => {
    res.redirect('/login');
});

// Routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const usersData = fs.existsSync(usersFilePath) ? fs.readFileSync(usersFilePath) : '[]';
    const users = JSON.parse(usersData);

    const user = users.find((user) => user.username === username && user.password === password);

    if (user) {
        req.session.userId = user.id;
        const userUrl = `/user/${user.id}/dashboard`;
        res.redirect(userUrl);
    } else {
        res.status(401).send('Invalid credentials!');
    }
});

// Route for the user's unique dashboard
app.get('/user/:userId/dashboard', (req, res) => {
    const { userId } = req.params;

    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Modify the ask route to use the unique URL
app.post('/user/:userId/ask', (req, res) => {
    const { userId } = req.params;

    // Validate the user ID with the session
    if (parseInt(userId) !== req.session.userId) {
        
    }

    const question = req.body.question.trim();

    const query = 'SELECT file_path FROM excel_files WHERE user_id = ?';

    db.query(query, [userId], (err, results) => {
        if (!results.length) return res.status(404).send('No Excel files found.');

        let answer = null;

        results.forEach(file => {
            const filePath = file.file_path;
            if (fs.existsSync(filePath)) {
                const workbook = xlsx.readFile(filePath);
                const data = workbook.SheetNames.flatMap(sheet => xlsx.utils.sheet_to_json(workbook.Sheets[sheet]));

                const fuse = new Fuse(data, {
                    keys: ['Question'],
                    threshold: 0.4
                });

                const result = fuse.search(question);
                if (result.length > 0) answer = result[0].item.Answer;
            }
        });

        res.json({ message: answer || 'No matching answer found.' });
    });
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});


app.post('/signup', upload.array('excel_files', 10), (req, res) => {
    const { business_name, username, password, email, phone } = req.body;
    const files = req.files;

    if (!business_name || !username || !password || !email || !phone) {
        return res.status(400).send('All fields are required.');
    }

    let users = [];
    if (fs.existsSync(usersFilePath)) {
        try {
            const usersData = fs.readFileSync(usersFilePath, 'utf-8');
            users = JSON.parse(usersData || '[]'); // Handle empty files gracefully
        } catch (err) {
            console.error('Error parsing users.json:', err);
            return res.status(500).send('Server error: Failed to process users.');
        }
    }

    if (users.some((user) => user.username === username)) {
        return res.status(400).send('Username already exists.');
    }

    const newUser = {
        id: users.length + 1,
        business_name,
        username,
        password,
        email,
        phone,
        files: files.map((file) => path.join('./uploads', file.originalname)),
    };

    users.push(newUser);
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Error writing to users.json:', err);
        return res.status(500).send('Server error: Failed to save user data.');
    }

    files.forEach((file) => {
        const filePath = path.join('./uploads', file.originalname);
        const workbook = xlsx.readFile(filePath);
        const data = workbook.SheetNames.flatMap((sheet) =>
            xlsx.utils.sheet_to_json(workbook.Sheets[sheet])
        );

        const userDataFilePath = path.join(__dirname, 'data', `user_${newUser.id}_data.json`);
        try {
            fs.writeFileSync(userDataFilePath, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Error saving user Excel data:', err);
            return res.status(500).send('Server error: Failed to process Excel files.');
        }
    });

    console.log('Signup data saved successfully.');
    res.redirect('/login');
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// app.post('/ask', (req, res) => {
//     if (!req.session.userId) {
//         return res.status(401).send('Unauthorized. Please login first.');
//     }

//     const question = req.body.question.trim();
//     const referrer = req.get('Referer');
//     const userId = referrer?.split('/user/')[1]?.split('/')[0];
//     console.log(userId);
//     // const userId = req.session.userId;

//     if (!question) {
//         return res.status(400).send('Question is required.');
//     }

//     // Read the current users data from users.json
//     const usersData = fs.existsSync(usersFilePath) ? fs.readFileSync(usersFilePath) : '[]';
//     const users = JSON.parse(usersData);

//     // Find the user based on session userId
//     const user = users.find((u) => u.id === userId);
//     if (!user) {
//         return res.status(404).send('User not found.');
//     }

//     // Check if the user has uploaded any files
//     if (!user.files || user.files.length === 0) {
//         return res.status(404).send('No uploaded files found for this user.');
//     }

//     // Use the most recent file (last uploaded file)
//     const latestFile = user.files[user.files.length - 1];
//     if (!fs.existsSync(latestFile)) {
//         return res.status(404).send('Latest file not found on the server.');
//     }

//     // Read the Excel file to get the latest data
//     const workbook = xlsx.readFile(latestFile);
//     const data = workbook.SheetNames.flatMap(sheet =>
//         xlsx.utils.sheet_to_json(workbook.Sheets[sheet])
//     );

//     // Find a matching answer to the user's question
//     let responseMessage = 'No matching answer found.';
//     const fuse = new Fuse(data, {
//         keys: ['Question'], // Ensure your Excel data has a "Question" column
//         threshold: 0.4,
//     });

//     const result = fuse.search(question);
//     if (result.length > 0) {
//         responseMessage = result[0].item.Answer; // Ensure your Excel data has an "Answer" column
//     }

//     // Adding a delay to ensure processing
//     setTimeout(() => {
//         res.json({ message: responseMessage });
//     }, 1000); // Delay of 1000ms (1 second)
// });

app.post('/ask', (req, res) => {
    const question = req.body.question?.trim();
    if (!question) {
        return res.status(400).send('Question is required.');
    }

    // Extract userId from the Referer header
    const referrer = req.get('Referer');
    const userId = Number(referrer?.split('/user/')[1]?.split('/')[0])
    console.log(userId)
    if (!userId) {
        console.log('User ID is missing or invalid.');
        
        return res.status(400).send('User ID is missing or invalid.');
    }

    // Read the users.json file
    const usersData = fs.existsSync(usersFilePath) ? fs.readFileSync(usersFilePath) : '[]';
    const users = JSON.parse(usersData);

    // Find the user with the extracted userId
    const user = users.find((u) => u.id === userId);
    if (!user) {
        console.log('User not found.');
        
        return res.status(404).send('User not found.');
    }

    // Check if the user has uploaded any files
    if (!user.files || user.files.length === 0) {
        console.log('No uploaded files found for this user.');
        
        return res.status(404).send('No uploaded files found for this user.');
    }

    // Use the most recent file
    const latestFile = user.files[user.files.length - 1];
    if (!fs.existsSync(latestFile)) {
        console.log('Latest file not found on the server.');
        return res.status(404).send('Latest file not found on the server.');
    }

    // Read the Excel file
    const workbook = xlsx.readFile(latestFile);
    const data = workbook.SheetNames.flatMap(sheet =>
        xlsx.utils.sheet_to_json(workbook.Sheets[sheet])
    );

    // Search for a matching answer
    let responseMessage = 'No matching answer found.';
    const fuse = new Fuse(data, {
        keys: ['Question'],
        threshold: 0.4,
    });
    const result = fuse.search(question);
    if (result.length > 0) {
        responseMessage = result[0].item.Answer;
    }

    // Respond after a delay
    setTimeout(() => {
        res.json({ message: responseMessage });
    }, 1000);
});


// Upload Excel file and update database
app.post('/upload-excel', upload.single('excel_file'), (req, res) => {
    if (!req.session.userId) return res.status(401).send('Unauthorized. Please log in first.');

    const userId = req.session.userId;
    const filePath = req.file.path;

    if (!filePath) return res.status(400).send('No file uploaded.');

    try {
        // Read the current users data from users.json
        const usersData = fs.existsSync(usersFilePath) ? fs.readFileSync(usersFilePath) : '[]';
        const users = JSON.parse(usersData);

        // Find the user based on session userId
        const userIndex = users.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            return res.status(404).send('User not found.');
        }

        // Determine the user's upload directory
        const userUploadDir = path.join(__dirname, 'uploads', `user_${userId}`);
        if (!fs.existsSync(userUploadDir)) {
            fs.mkdirSync(userUploadDir, { recursive: true });
        }

        // Define the new file path in the user's upload directory
        const newFilePath = path.join(userUploadDir, req.file.originalname);

        // Move the uploaded file to the user's directory
        fs.renameSync(filePath, newFilePath);

        // Read the Excel file to get its data
        const workbook = xlsx.readFile(newFilePath);
        const data = workbook.SheetNames.flatMap(sheet =>
            xlsx.utils.sheet_to_json(workbook.Sheets[sheet])
        );

        // Update the user's files and Excel data
        users[userIndex].files = users[userIndex].files || [];
        users[userIndex].files.push(newFilePath); // Append the new file path
        users[userIndex].excelData = data; // Replace with the new Excel data

        // Write the updated users data back to users.json
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        res.send('Excel file uploaded and data updated successfully.');
    } catch (err) {
        console.error('Error processing Excel file:', err);
        res.status(500).send('Failed to process Excel file.');
    }
});


// Change Password Endpoint
app.post('/change-password', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Unauthorized.');
    }

    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (new_password !== confirm_password) {
        return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const userId = req.session.userId;

    // Read users data from users.json
    const usersData = fs.existsSync(usersFilePath) ? fs.readFileSync(usersFilePath) : '[]';
    const users = JSON.parse(usersData);

    // Find the user based on session userId
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[userIndex];

    // Verify old password
    if (user.password !== old_password) {
        return res.status(400).json({ success: false, message: 'Old password is incorrect.' });
    }

    // Update to new password
    users[userIndex].password = new_password;

    // Write updated users data back to users.json
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Error updating users.json:', err);
        res.status(500).json({ success: false, message: 'Failed to update password.' });
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
