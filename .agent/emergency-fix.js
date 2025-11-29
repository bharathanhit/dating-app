// EMERGENCY FIX - Run this in browser console NOW
// This will tell us exactly what's wrong

console.clear();
console.log('🚨 FIREBASE EMERGENCY DIAGNOSTICS 🚨\n');

// Check 1: Is Firebase loaded?
if (typeof firebase === 'undefined') {
  console.error('❌ CRITICAL: Firebase is not loaded!');
  console.log('Solution: Refresh the page');
} else {
  console.log('✅ Firebase SDK loaded');
}

// Check 2: Is user logged in?
const user = firebase.auth().currentUser;
if (!user) {
  console.error('❌ CRITICAL: You are NOT logged in!');
  console.log('👉 SOLUTION: Log in to the app first, then try again');
  console.log('   The permission error happens because Firebase requires authentication');
} else {
  console.log('✅ User is logged in');
  console.log('   UID:', user.uid);
  console.log('   Email:', user.email);
}

// Check 3: Database URL
const dbUrl = firebase.app().options.databaseURL;
console.log('\n📍 Database URL:', dbUrl);
if (dbUrl !== 'https://date-3963e-default-rtdb.firebaseio.com') {
  console.warn('⚠️  Database URL might be wrong!');
}

// Check 4: Test WRITE to exact path from error
console.log('\n🧪 Testing WRITE to conversations path...');
const testPath = 'conversations/test_' + Date.now() + '/messages';
console.log('   Path:', testPath);

if (user) {
  firebase.database()
    .ref(testPath)
    .push({
      text: 'Test from diagnostics',
      senderId: user.uid,
      createdAt: Date.now()
    })
    .then(() => {
      console.log('✅ SUCCESS! Write permission works!');
      console.log('👉 This means your Firebase rules ARE configured correctly');
      console.log('👉 The issue might be:');
      console.log('   1. You were not logged in when you tried to send the message');
      console.log('   2. The auth token expired - try logging out and back in');
      console.log('   3. Browser cache - try hard refresh (Ctrl+Shift+R)');
    })
    .catch(err => {
      console.error('❌ FAILED! Write permission denied');
      console.error('   Error:', err.message);
      console.log('\n🔧 IMMEDIATE FIX:');
      console.log('   Your Firebase Rules are NOT configured correctly!');
      console.log('   Follow these steps RIGHT NOW:');
      console.log('   1. Open: https://console.firebase.google.com/');
      console.log('   2. Select: date-3963e');
      console.log('   3. Click: Realtime Database → Rules');
      console.log('   4. Replace ALL rules with this:');
      console.log('\n' + '='.repeat(60));
      console.log(JSON.stringify({
        "rules": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }, null, 2));
      console.log('='.repeat(60));
      console.log('   5. Click PUBLISH');
      console.log('   6. Wait 30 seconds');
      console.log('   7. Refresh this page (Ctrl+Shift+R)');
    });
} else {
  console.error('❌ Cannot test - you must log in first!');
}

// Check 5: Read test
console.log('\n📖 Testing READ permission...');
firebase.database()
  .ref('conversations')
  .limitToFirst(1)
  .once('value')
  .then(snapshot => {
    console.log('✅ READ permission works');
  })
  .catch(err => {
    console.error('❌ READ permission failed:', err.message);
  });

// Summary after 2 seconds
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  if (!user) {
    console.log('🔴 PROBLEM: You are NOT logged in');
    console.log('✅ SOLUTION: Log in to the app, then try sending a message again');
  } else {
    console.log('✅ You are logged in');
    console.log('⏳ Check the write test result above');
    console.log('   If it says SUCCESS: Your rules are fine, just refresh the page');
    console.log('   If it says FAILED: Follow the fix steps shown above');
  }
  console.log('='.repeat(60));
}, 2000);
