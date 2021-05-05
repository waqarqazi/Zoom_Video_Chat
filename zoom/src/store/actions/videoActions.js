import IO from 'socket.io-client';
import Peer from 'react-native-peerjs';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {ID} from './authActions';

/** Web RTC */
import {mediaDevices} from 'react-native-webrtc';
import {
  ADD_MY_PEERID,
  ADD_REMOTE_STREAM,
  ADD_STREAM,
  ALL_USERS,
  MY_STREAM,
} from './types';
import {call} from 'react-native-reanimated';

//** API_URI */
export const API_URI = `http://192.168.10.3:5000`;

const peerServer = new Peer(undefined, {
  secure: false,
  config: {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
  },
});

peerServer.on('error', console.log);

//** Socket Config */
export const socket = IO(`${API_URI}`, {
  forceNew: true,
});

socket.on('connection', () => console.log('Connection'));

export const joinGeneralRoom = () => async (dispatch) => {
  socket.emit('join-general-room', 'ajsdflajslkdfuaisfjwioerwqiheriyqw87ery');
};

export const userJoin = () => async (dispatch, getState) => {
  const allUserRoomID = 'ajdsflkjaskjalksjdf';
  const roomID = 'active_room_id';
  const {user, allUsers} = getState().auth;

  //User Exits
  socket.emit('user-exists', {user, socketID: socket.id});

  // User is found
  socket.on('user-found', (currentUser) => {
    if (currentUser) {
      socket.emit('update-user', {
        user,
        socketID: socket.id,
        allUserRoomID,
      });
    } else {
      console.log('emited');
      socket.emit('user-join', {allUserRoomID, user, socketID: socket.id});
    }
  });

  //Get Other Users
  socket.on('activeUsers', (users) => {
    const eUsers = allUsers.map(({email}) => email);
    const fUsers = users
      .map(({email, name, socketID, uid, _id}) => {
        if (!eUsers.includes(email)) {
          return {
            email,
            name,
            socketID,
            uid,
            _id,
          };
        }
      })
      .filter((data) => data !== undefined);
    console.log('fUsers', fUsers);
    //Get all users
    dispatch({type: ALL_USERS, payload: fUsers});
  });

  //Get new user joined
  socket.on('new-user-join', (user) => {
    dispatch({type: 'ADD_NEW_USER', payload: user});
  });
};

// Stream Actions
export const joinStream = (stream) => async (dispatch, getState) => {
  const {user} = getState().auth;
  const roomID = 'stream_general_room';

  dispatch({type: MY_STREAM, payload: stream});

  dispatch({
    type: ADD_STREAM,
    payload: {
      stream,
      ...user,
    },
  });

  // Starts here
  peerServer.on('open', (peerID) => {
    socket.emit('join-stream-room', {
      roomID,
      peerID,
      socketID: socket.id,
      user,
    });
  });
  socket.on('user-connected', ({peerID, user, roomID, socketID}) => {
    connectToNewUser({peerID, user, roomID, socketID, stream});
  });
  //Last user recive a call
  peerServer.on('call', (call) => {
    //Answer back to all remote streams
    call.answer(stream);

    //Answer the remote calls back from the last device
    call.on('stream', (remoteStreams) => {
      // Add other streams to stream arrays
      dispatch({
        type: ADD_STREAM,
        payload: {
          stream: remoteStreams,
          name: `user_${ID()}`,
          uid: `id_${ID()}`,
          email: `emu@gmail.com`,
        },
      });
    });
  });

  function connectToNewUser({peerID, user, roomID, socketID, stream}) {
    // call the last user from other devices
    const call = peerServer.call(peerID, stream);

    //Remote users answers the last connected devices
    call.on('stream', (lastuserstream) => {
      if (lastuserstream) {
        dispatch({
          type: ADD_REMOTE_STREAM,
          payload: {
            stream,
            lastuserstream,
            ...user,
          },
        });
      }
    });
  }
};

export const disconnect = () => async () => {
  // peerServer.disconnect();
};

export const stream = () => async (dispatch) => {
  let isFront = true;
  mediaDevices.enumerateDevices().then((sourceInfos) => {
    let videoSourceId;
    for (let i = 0; i < sourceInfos.length; i++) {
      const sourceInfo = sourceInfos[i];
      if (
        sourceInfo.kind == 'videoinput' &&
        sourceInfo.facing == (isFront ? 'front' : 'environment')
      ) {
        videoSourceId = sourceInfo.deviceId;
      }
    }

    mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          mandatory: {
            minWidth: 500,
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: isFront ? 'user' : 'environment',
          optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
        },
      })
      .then((stream) => {
        dispatch(joinStream(stream));
      })
      .catch((error) => {
        console.log('error', error);
      });
  });
};
