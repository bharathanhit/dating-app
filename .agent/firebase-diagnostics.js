// Firebase Connection Test
// Run this in browser console to diagnose permission issues

console.log('🔍 Starting Firebase Diagnostics...\n');

// Test 1: Check Firebase is loaded
try {
  if (typeof firebase !== 'undefined') {
    console.log('✅ Test 1: Firebase SDK loaded');
  } else {
    console.error('❌ Test 1: Firebase SDK not loaded');
  }
} catch (e) {
  console.error('❌ Test 1: Error -', e.message);
}

// Test 2: Check Authentication
try {
  const currentUser = firebase.auth().currentUser;
  if (currentUser) {
    console.log('✅ Test 2: User authenticated');
    console.log('   User ID:', currentUser.uid);
    console.log('   Email:', currentUser.email);
  } else {
    console.error('❌ Test 2: User NOT authenticated (not logged in)');
    console.log('   👉 Please log in to the app first!');
  }
} catch (e) {
  console.error('❌ Test 2: Error -', e.message);
}

// Test 3: Check Database URL
try {
  const dbUrl = firebase.app().options.databaseURL;
  console.log('✅ Test 3: Database URL configured');
  console.log('   URL:', dbUrl);
  
  if (dbUrl !== 'https://date-3963e-default-rtdb.firebaseio.com') {
    console.warn('⚠️  Warning: Database URL might be incorrect');
    console.log('   Expected: https://date-3963e-default-rtdb.firebaseio.com');
  }
} catch (e) {
  console.error('❌ Test 3: Error -', e.message);
}

// Test 4: Try to read from database
console.log('\n📖 Test 4: Testing READ permission...');
firebase.database()
  .ref('conversations')
  .once('value')
  .then(snapshot => {
    console.log('✅ Test 4: READ permission works');
    console.log('   Data exists:', snapshot.exists());
    if (snapshot.exists()) {
      console.log('   Number of conversations:', Object.keys(snapshot.val()).length);
    }
  })
  .catch(err => {
    console.error('❌ Test 4: READ permission FAILED');
    console.error('   Error:', err.message);
    console.log('   👉 Check Firebase Rules allow reading');
  });

// Test 5: Try to write to database
console.log('\n✍️  Test 5: Testing WRITE permission...');
const testRef = firebase.database().ref('conversations/test_' + Date.now() + '/messages');
const currentUser = firebase.auth().currentUser;

if (currentUser) {
  testRef.push({
    text: 'Test message from diagnostics',
    senderId: currentUser.uid,
    createdAt: Date.now()
  })
  .then(() => {
    console.log('✅ Test 5: WRITE permission works!');
    console.log('   👉 Your Firebase rules are configured correctly!');
    console.log('   👉 The issue might be somewhere else in your code.');
    
    // Clean up test data
    testRef.remove();
  })
  .catch(err => {
    console.error('❌ Test 5: WRITE permission FAILED');
    console.error('   Error:', err.message);
    console.log('\n🔧 SOLUTION:');
    console.log('   1. Go to: https://console.firebase.google.com/');
    console.log('   2. Select project: date-3963e');
    console.log('   3. Click: Realtime Database → Rules');
    console.log('   4. Copy the rules from .agent/FIX_PERMISSION_ERROR.md');
    console.log('   5. Click Publish');
    console.log('   6. Wait 30 seconds and refresh this page');
  });
} else {
  console.error('❌ Test 5: Cannot test WRITE - user not logged in');
  console.log('   👉 Please log in to the app first!');
}

// Test 6: Check specific conversation path
setTimeout(() => {
  console.log('\n🎯 Test 6: Testing specific conversation path...');
  const convId = 'conv_dLuSKlCurTVezfOVOfTmQEua84u1_wdOiRULhYIPPO2qji959Eqo2hb23';
  
  firebase.database()
    .ref(`conversations/${convId}/messages`)
    .once('value')
    .then(snapshot => {
      console.log('✅ Test 6: Can read conversation messages');
      console.log('   Messages exist:', snapshot.exists());
      if (snapshot.exists()) {
        console.log('   Number of messages:', Object.keys(snapshot.val()).length);
      }
    })
    .catch(err => {
      console.error('❌ Test 6: Cannot read conversation messages');
      console.error('   Error:', err.message);
    });
}, 2000);

// Summary
setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('='.repeat(50));
  console.log('Check the results above:');
  console.log('- If all tests pass ✅: Your Firebase is configured correctly');
  console.log('- If Test 2 fails ❌: You need to log in');
  console.log('- If Test 4 or 5 fails ❌: You need to configure Firebase Rules');
  console.log('\nFor detailed fix instructions, see:');
  console.log('.agent/FIX_PERMISSION_ERROR.md');
  console.log('='.repeat(50));
}, 3000);
