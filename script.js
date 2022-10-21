import { initializeApp } from "https://www.gstatic.com/firebasejs/9.4.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/9.4.0/firebase-firestore.js"

const firebaseConfig = {
    apiKey: "AIzaSyBBQVOILXtvSoHLpC4qHzS33UCI4QksgD4",
    authDomain: "rtc-peer2peer-32efd.firebaseapp.com",
    projectId: "rtc-peer2peer-32efd",
    storageBucket: "rtc-peer2peer-32efd.appspot.com",
    messagingSenderId: "738693033685",
    appId: "1:738693033685:web:fe0e29ab66eb15c2b43c5c"   
}

// initialize firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
};

let localStream;
let remoteStream;
let pc = new RTCPeerConnection(servers);

let roomId;

function init() {
  const cam = document.getElementById('cam');
  const mic = document.getElementById('mic');
  const hangup = document.getElementById('hangup');
  const info = document.getElementById('info');
}

window.onload = async function() {
  let request = sessionStorage.getItem('request');
  await getMedia();
  if(request) {
    if (request == 'create') {
      createRoom();
    } else {
      roomId = sessionStorage.getItem('roomID');
      joinRoom();
    }
  } else {
    window.location = './index.html';
  }
}


async function createRoom() {
  //creating room
  const roomRef = doc(collection(db,'calls'));
  roomId = roomRef.id;
  roomIndicator.innerHTML = roomId;

  pc.onicecandidate = async (event) => {
    if(event.candidate) {
      setDoc(doc(roomRef,'offerCandidates','candidates'), event.candidate.toJSON());
    }
  }
  //creating offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const roomWithOffer = {
        sdp: offer.sdp,
        type: offer.type,
  };

  await setDoc(roomRef,{roomWithOffer});

  onSnapshot(roomRef, (doc) => {
    const data = doc.data();
    if(!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    };
  });

  const q = query(collection(roomRef, 'answerCandidates'));
  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if(change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    })
  })

}

async function joinRoom() {
  roomIndicator.innerHTML = roomId;

  const roomRef = doc(db,'calls', roomId);
  const roomSnap = await getDoc(roomRef);

  pc.onicecandidate = async (event) => {
    if(event.candidate) {
      setDoc(doc(roomRef,'answerCandidates','candidates'), event.candidate.toJSON());
    }
  }

  const offerDescription = roomSnap.data();
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription.roomWithOffer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await updateDoc(roomRef, {answer});

  const q = query(collection(roomRef, 'offerCandidates'));
  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if(change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    })
  })
}

async function getMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  document.getElementById('local').srcObject = localStream;
  document.getElementById('guest').srcObject = remoteStream;

  // setting local stream
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  //getting remote stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };
}

cam.addEventListener('click', () => {
  const videoTrack = localStream.getTracks().find(track => track.kind === 'video');
  if(videoTrack.enabled) {
    videoTrack.enabled = false;
    cam.style.backgroundColor = 'black';
    cam.style.color = 'white';
  } else {
    videoTrack.enabled = true;
    cam.style.backgroundColor = 'white';
    cam.style.color = 'black';
  }
})

mic.addEventListener('click', () => {
  const audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
  if(audioTrack.enabled) {
    audioTrack.enabled = false;
    mic.style.backgroundColor = 'black';
    mic.style.color = 'white';
  } else {
    audioTrack.enabled = true;
    mic.style.backgroundColor = 'white';
    mic.style.color = 'black';
  }
})

hangup.addEventListener('click',() => {
  const vidTrack = localStream.getTracks().find(track => track.kind === 'video');
  if(vidTrack.enabled) {
    vidTrack.enabled = false;
  }
  setTimeout(async () => {
    if(pc) {
      pc.close();
    }
  
    const roomRef = doc(db,'calls', roomId);
    if(roomId) {
      await deleteDoc(doc(roomRef,'offerCandidates','candidates'));
      await deleteDoc(doc(roomRef,'answerCandidates','candidates'));
      await deleteDoc(doc(db,'calls', roomId));
    }
  
    sessionStorage.removeItem('request');
    if(sessionStorage.getItem('roomID')) {
      sessionStorage.removeItem('roomID');
    }
  
    window.location = './index.html';
  }, 500);
})

const details = document.querySelector('.details');
info.addEventListener('click', () => {
  if(details.style.display == 'none') {
    details.style.display = 'inherit';
    info.style.backgroundColor = 'white';
    info.style.color = 'black';
  } else {
    details.style.display = 'none';
    info.style.backgroundColor = 'black';
    info.style.color = 'white';
  }
})

const timeIndicator = document.querySelector('#callTime');
const roomIndicator = document.querySelector('#roomValue');

function callTime() {
  let hour = 0
  let mins = 0
  let sec = 0
  setInterval(function () {
    sec++;
    if(sec == 60) {
      sec = 0;
      mins++;
    }
    if(mins == 60) {
      mins = 0;
      hour++;
    }
    timeIndicator.innerHTML = (hour).toString() + ' : ' + (mins).toString() + ' : ' + (sec).toString();
  },1000);
}

init();
callTime();