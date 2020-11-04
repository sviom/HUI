const RunSocket = (eventName, callback, resolve, reject) => {

};

const RunSockets = (io, connectionName, resolve, reject) => {
    let resultSocket;
    io.sockets.on(connectionName, function (socket) { 
        resultSocket = socket;
    });

    resolve(resultSocket);
};

const SocketOnAsync = (eventName, callback) => {
    return new Promise((resolve, reject) => {
        RunSocket(eventName, callback, resolve, reject);
    });
};

const SocketsOnAsync = (io, connectionName) => {
    return new Promise((resolve, reject) => {
        RunSockets(io, connectionName, resolve, reject);
    });
};

module.exports = {
    SocketOnAsync, SocketsOnAsync
}