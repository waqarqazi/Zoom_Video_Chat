const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const { ExpressPeerServer } = require("peer");
const mongoose = require("mongoose");
const config = require("config");

const app = express();

const server = http.createServer(app);
const io = socketio(server).sockets;

//** Peer Server */
const customGenerationFunction = () =>
  (Math.random().toString(36) + "0000000000000000000").substr(2, 16);

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/",
  generateClientId: customGenerationFunction,
});

app.use("/mypeer", peerServer);

//** Config */
const db = config.get("mongoURI");
const Active = require("./schema/Active");
//* Connect to mongoDB *//
mongoose
  .connect(db, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

//* Websocket *//
io.on("connection", function (socket) {
  socket.on('join-general-room', ({ roomID }) => {
    //console.log("roomID",roomID);
    socket.join(roomID);
  });
  socket.on('user-exists', ({ user, socketID }) => {
    // console.log("user-exists",user)
    //check if the new user exits in active chat
    Active.findOne({ email: user.email }).then((user) => {
      //Emit found to last connectd user
      io.in(socketID).emit('user-found', user);
    });

    //Update user if found
    socket.on('update-user', ({ user, socketID, allUserRoomID }) => {
      socket.join(allUserRoomID);

      //Find user and update the socket id

      Active.findOneAndUpdate(
        { email: user.email },
        { $set: { socketID } },
        { new: true },
        (err, doc) => {
          console.log("doc", doc);
          if (doc) {
            // send active users to the last connected user
            Active.find({}).then((allUsers) => {
              const otherUsers = allUsers.filter(
                ({ email: otherEmails }) => otherEmails !== user.email
              );
              io.in(socketID).emit('activeUsers', otherUsers);
            });
          }
        }
      );
      //Notify other user about updateded or joined user
      socket
        .to(allUserRoomID)
        .broadcast.emit("new-user-join", [{ ...user, socketID }]);
    });

    socket.on("user-join", ({ allUserRoomID, user, socketID }) => {
      socket.join(allUserRoomID);

      // store new user in active chats
      const active = new Active({ ...user, socketID });

      //find the document || add the document
      Active.findOne({ email: user.email }).then((user) => {
        if (!user) {
          active.save().then(({ email }) => {
            Active.find({}).then((users) => {
              const otherUsers = users.filter(
                ({ email: otherEmails }) => otherEmails !== email
              );
              // Send others to new connected  user
              io.in(socketID).emit('activeUsers', otherUsers);
            });
          });
        } else {
          // Emit to all other users the last joined uer
          socket.to(allUserRoomID).broadcast.emit('new-user-join', user);
        }
      });
    });
  });

  ///listen for peer connections
  socket.on('join-stream-room', ({ roomID, peerID, socketID, user }) => {
    socket.join(roomID);

    //Emit to other users
    socket.to(roomID).broadcast.emit('user-connected', {
      peerID,
      user,
      roomID,
      socketID,
    });
  });
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server started on port ${port}`));
