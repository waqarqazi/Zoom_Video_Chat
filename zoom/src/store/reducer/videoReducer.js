import {ADD_STREAM, MY_STREAM,ADD_REMOTE_STREAM} from '../actions/types';

const initialState = {
  myStream: null,
  streams: [],
  remoteStreams: [],
};

export default (state = initialState, {type, payload}) => {
  switch (type) {
    case MY_STREAM:
      return {
        ...state,
        myStream: payload,
      };
    case ADD_STREAM:
      const streams = state.streams.filter(
        ({email}) => payload.email !== email,
      );
      return {
        ...state,
        streams: [...streams, payload],    
      };
    case ADD_REMOTE_STREAM:
      const otherStreams = state.streams.filter(
        ({email}) => payload.email !== email,
      );
      return {
        ...state,
        streams: [...otherStreams, payload],
      };
    default:
      return state;
  }
};
