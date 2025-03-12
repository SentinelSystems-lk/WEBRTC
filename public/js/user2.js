// WebRTC configuration with additional STUN servers for better connectivity
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const answerCallButton = document.getElementById('answerCallButton');
const hangupButton = document.getElementById('hangupButton');
const localVideoContainer = document.querySelector('.local-video-container');

// WebRTC variables
let localStream;
let peerConnection;
let socket;
let pendingOffer = null;

// Initialize socket.io connection
function initSocketConnection() {
  // Connect to current host (works on both localhost and LAN IP)
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to signaling server');
  });
  
  socket.on('offer', (offer) => {
    console.log('Received offer from User 1');
    pendingOffer = offer;
    
    // Enable the answer button immediately when an offer is received
    answerCallButton.disabled = false;
    answerCallButton.style.display = 'block';
    console.log('Call received - click "Answer Call" to connect');
    // Flash the answer button to draw attention
    flashButton(answerCallButton);
  });
  
  socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Added ICE candidate');
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  });
}

// Function to flash a button to draw attention
function flashButton(button) {
  let flashCount = 0;
  const originalColor = button.style.backgroundColor;
  
  const flash = setInterval(() => {
    if (flashCount % 2 === 0) {
      button.style.backgroundColor = '#ffeb3b'; // Yellow flash
    } else {
      button.style.backgroundColor = originalColor;
    }
    
    flashCount++;
    if (flashCount > 5) {
      clearInterval(flash);
      button.style.backgroundColor = originalColor;
    }
  }, 500);
}

// Update status message - now only logs to console
function updateStatus(message) {
  console.log(message);
}

// Start local video - now as a separate function that returns a promise
async function startLocalVideo() {
  try {
    // Add detailed permission instructions to help users
    updateStatus('Requesting camera and microphone access...');
    updateStatus('If prompted, please allow access to your camera and microphone.');
    
    try {
      // First try with both video and audio
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      updateStatus('Camera and microphone access granted');
    } catch (mediaError) {
      console.error('Error with audio+video:', mediaError);
      
      // If that fails, try with just video
      try {
        updateStatus('Trying with video only...');
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        updateStatus('Camera access granted (no audio)');
      } catch (videoError) {
        console.error('Error with video only:', videoError);
        throw new Error('Unable to access camera or microphone. ' + 
                        'If using Chrome or Edge, try Firefox instead for LAN testing.');
      }
    }
    
    localVideo.srcObject = localStream;
    updateStatus('Local video started');
    return true; // Successfully started video
    
  } catch (error) {
    console.error('Error accessing media devices:', error);
    updateStatus('Error: ' + error.message);
    
    // Provide helpful guidance based on browser
    const browser = detectBrowser();
    if (browser === 'Chrome' || browser === 'Edge') {
      updateStatus('Camera access denied. For Chrome/Edge on LAN, try using Firefox instead, ' +
                  'or create HTTPS certificate for secure access.');
    } else if (browser === 'Firefox') {
      updateStatus('Camera access denied. Make sure camera permissions are allowed in Firefox settings.');
    } else {
      updateStatus('Camera access denied. Please check your browser settings and permissions.');
    }
    return false; // Failed to start video
  }
}

// Detect browser for better error messages
function detectBrowser() {
  const userAgent = navigator.userAgent;
  
  if (userAgent.indexOf("Firefox") > -1) {
    return "Firefox";
  } else if (userAgent.indexOf("Chrome") > -1) {
    return userAgent.indexOf("Edg") > -1 ? "Edge" : "Chrome";
  } else if (userAgent.indexOf("Safari") > -1) {
    return "Safari";
  } else {
    return "Unknown";
  }
}

// Combined function to start video and answer call
async function startVideoAndAnswer() {
  // Disable the answer button while we're processing
  answerCallButton.disabled = true;
  
  // If we don't have a local stream yet, start the video first
  if (!localStream) {
    updateStatus('Starting video before answering call...');
    const videoStarted = await startLocalVideo();
    
    if (!videoStarted) {
      updateStatus('Failed to start video - cannot answer call');
      answerCallButton.disabled = false; // Re-enable the button to try again
      return;
    }
  }
  
  // Now proceed to answer the call
  await answerCall();
}

// Answer the call
async function answerCall() {
  try {
    if (!pendingOffer) {
      updateStatus('No offer to answer');
      answerCallButton.disabled = false;
      return;
    }
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(configuration);
    updateStatus('Created peer connection');
    
    // Add local stream to connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = (event) => {
      updateStatus('Connection state: ' + peerConnection.connectionState);
    };
    
    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
        updateStatus('Received remote stream');
      }
    };
    
    // Set remote description (offer)
    await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));
    
    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send answer back
    socket.emit('answer', answer);
    updateStatus('Sent answer to User 1');
    
    // Show local video container
    localVideoContainer.style.display = 'block';
    
    // Hide the answer button and show the hangup button
    answerCallButton.style.display = 'none';
    hangupButton.style.display = 'block';
    hangupButton.disabled = false;
  } catch (error) {
    console.error('Error creating answer:', error);
    updateStatus('Error creating answer: ' + error.message);
    answerCallButton.disabled = false;  // Re-enable the answer button on error
  }
}

// Hang up call
function hangUp() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Close the camera by stopping all tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
    localStream = null;
  }
  
  // Clear the video elements
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  // Hide local video container
  localVideoContainer.style.display = 'none';
  
  pendingOffer = null;
  answerCallButton.style.display = 'block';
  answerCallButton.disabled = true;
  hangupButton.style.display = 'none';
  hangupButton.disabled = true;
  updateStatus('Call ended, camera closed');
}

// Event listeners
answerCallButton.addEventListener('click', startVideoAndAnswer);
hangupButton.addEventListener('click', hangUp);

// Initialize socket connection
initSocketConnection();
