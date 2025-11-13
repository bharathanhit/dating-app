# BIXSOL - Dating Website

A modern, responsive dating application built with React, Material-UI, and Firebase Authentication.

## Features

✅ **Responsive Design** - Works perfectly on mobile, tablet, and desktop  
✅ **Firebase Authentication** - Secure email/password and Google Sign-In  
✅ **Profile Management** - View and edit user profiles  
✅ **Messaging System** - Chat with matches  
✅ **Like/Match System** - Like profiles and see matches  
✅ **Protected Routes** - Secure pages that require authentication  
✅ **Bottom Navigation Footer** - Easy access to main features  

## Tech Stack

- **Frontend**: React 19.2.0
- **UI Framework**: Material-UI (MUI) 5.14.18
- **Authentication**: Firebase 12.5.0
- **Routing**: React Router 7.0.0
- **Build Tool**: Vite 4.5.0
- **Styling**: Emotion (MUI's default styling solution)

## Prerequisites

Before you begin, ensure you have:
- Node.js (v16 or higher)
- npm or yarn
- A Firebase project (create one at [Firebase Console](https://console.firebase.google.com/))

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd BIXSOL
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use an existing one
   - Enable Authentication methods:
     - Email/Password
     - Google Sign-In
   - Copy your web app credentials

4. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```

5. **Update `.env.local` with your Firebase credentials**
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

## Running the App

**Development mode:**
```bash
npm run dev
```

The app will start at `http://localhost:5173` (or another available port)

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── Navbar.jsx              # Top navigation with auth state
│   ├── Footer.jsx              # Bottom navigation with floating button
│   ├── ProfileCard.jsx         # Profile display component
│   ├── ProtectedRoute.jsx      # Route guard for authenticated pages
│   └── GoogleSignInButton.jsx  # Google authentication button
├── config/
│   └── firebase.js             # Firebase initialization
├── context/
│   └── AuthContext.jsx         # Authentication context & hooks
├── pages/
│   ├── HomePage.jsx            # Discover profiles
│   ├── LoginPage.jsx           # User login
│   ├── SignUpPage.jsx          # User registration
│   ├── ProfilePage.jsx         # User profile view/edit
│   └── MessagesPage.jsx        # Messages/chat
├── App.jsx                     # Main app component
├── App.css                     # Global styles
└── main.jsx                    # React entry point
```

## Authentication Features

### Sign Up with Google
1. Click "Sign up with Google" button on Sign Up or Login page
2. Select your Google account
3. You're automatically logged in and redirected to home

### Sign Up with Email
1. Click "Sign Up" link on Login page
2. Enter email and password (min 6 characters)
3. Confirm password
4. Account is created and you're logged in

### Login
1. Go to `/login`
2. Enter email and password
3. Or click "Sign in with Google"

### Logout
1. Click menu icon (mobile) or logout button (desktop)
2. Select "Logout"
3. Redirected to login page

## Protected Routes

The following routes require authentication:
- `/profile` - User profile page
- `/messages` - Messages/chat page

Unauthenticated users trying to access these routes will be redirected to `/login`

## Firebase Setup Detailed Guide

### 1. Create Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Click "Add Project"
- Enter project name
- Complete the setup

### 2. Enable Email/Password Authentication
- Go to Authentication > Sign-in method
- Click "Email/Password"
- Enable "Email/Password"
- Save

### 3. Enable Google Sign-In
- In Authentication > Sign-in method
- Click "Google"
- Enable Google
- Set up OAuth consent screen
- Save

### 4. Get Your Config Keys
- Go to Project Settings
- Find "Web apps"
- Copy the Firebase config values
- Add to `.env.local`

## Usage Examples

### Use Authentication Hook
```javascript
import { useAuth } from './context/AuthContext.jsx';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={() => login(email, password)}>Login</button>
      )}
    </div>
  );
}
```

### Protect a Route
```javascript
<ProtectedRoute>
  <MyProtectedComponent />
</ProtectedRoute>
```

## Responsive Design

The app is fully responsive with breakpoints for:
- **xs** (0px - 600px): Mobile phones
- **sm** (600px - 900px): Tablets
- **md** (900px+): Desktops

All components automatically adapt to screen size using Material-UI's responsive props.

## Troubleshooting

### "Port 5173 is in use"
Use a different port:
```bash
npm run dev -- --port 3000
```

### Firebase connection errors
- Check `.env.local` has all required variables
- Verify Firebase project is active
- Check API keys are correct

### Google Sign-In not working
- Ensure Google Sign-In is enabled in Firebase Console
- Check OAuth consent screen is configured
- Verify domain is added to authorized domains

## Contributing

To add new features:
1. Create a new branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

This project is open source and available under the MIT License.

---

**Happy Dating! 💕**
