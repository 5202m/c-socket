'use strict';
const events = require("events");
module.exports = {
    namespace: {
        "/studio": {
            serverUrl:"http://192.168.35.81:3001/message"
        },
        "/fxstudio": {
            serverUrl:"http://192.168.35.81:3001/message"
        },
        "/hxstudio": {
            serverUrl:"http://192.168.35.81:3001/message"
        },
        "/cfstudio": {
            serverUrl:"http://192.168.35.81:3001/message"
        }
    },
    redis: {
        host: '192.168.35.236',
        port: 6379
    },
    msgType: {
        join: "join",
        leave: "leave",
        setData: "setData",
        setUUID: "setUUID",
        sendMsg: "sendMsg",
        init:"init"
    }
};