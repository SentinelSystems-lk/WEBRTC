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
const startCallButton = document.getElementById('startCallButton');
const hangupButton = document.getElementById('hangupButton');
const localVideoContainer = document.querySelector('.local-video-container');

// WebRTC variables
let localStream;
let peerConnection;
let socket;

// Initialize socket.io connection
function initSocketConnection() {
  // Connect to current host (works on both localhost and LAN IP)
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to signaling server');
  });
  
  socket.on('answer', async (answer) => {
    console.log('Received answer from User 2');
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Connection established!');
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  });
  
  socket.on('ice-candidate', async (candidate) => {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Added ICE candidate');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  });
}

// Update status message - now only logs to console
function updateStatus(message) {
  console.log(message);
}

// Combined function to start local video and then call
async function startVideoAndCall() {
  // Disable the button while we're processing
  startCallButton.disabled = true;
  
  // First start the local video
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
    updateStatus('Local video started, initiating call...');
    
    // Now proceed to start the call
    await initiateCall();
    
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
    startCallButton.disabled = false; // Re-enable the button on error
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

// Function to initiate call (separated from the UI function)
async function initiateCall() {
  try {
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
    
    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Send offer to signaling server
    socket.emit('offer', offer);
    updateStatus('Sent offer to User 2');
    
    // Show local video container and change buttons
    localVideoContainer.style.display = 'block';
    startCallButton.style.display = 'none';
    hangupButton.style.display = 'block';
    hangupButton.disabled = false;
  } catch (error) {
    console.error('Error creating peer connection:', error);
    updateStatus('Error creating peer connection: ' + error.message);
    startCallButton.disabled = false; // Re-enable the call button on error
  }
}

// Hang up call
function hangUp() {
  // Close the peer connection if it exists
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
  
  // Reset UI
  localVideoContainer.style.display = 'none';
  startCallButton.style.display = 'block';
  startCallButton.disabled = false;
  hangupButton.style.display = 'none';
  hangupButton.disabled = true;
  
  updateStatus('Call ended, camera closed');
}

// Event listeners
startCallButton.addEventListener('click', startVideoAndCall);
hangupButton.addEventListener('click', hangUp);

// Initialize socket connection
initSocketConnection();
