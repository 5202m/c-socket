'use strict';
const config=require('../../config/config');
const msgpack = require('msgpack-js');
const storageService = require("../../service/StorageService");
const log = require("../../log4j/logHelper").getLogger("MessageHandler");
/****
 * 对消息的处理，发送消息、加入房间、离开房间
 */
class MessageHandler{
    constructor(){
        this.eventTypeMap = new Map();
        this.eventTypeMap.set(config.eventType.sendMsg,{fn:this.sendMsg.bind(this),isChat:true});
        this.eventTypeMap.set(config.eventType.join,{fn:this.join.bind(this)});
        this.eventTypeMap.set(config.eventType.leave,{fn:this.leave.bind(this)});
        this.eventTypeMap.set(config.eventType.setUUID,{fn:this.setUUID.bind(this)});
        this.eventTypeMap.set(config.eventType.onlineList,{fn:this.onlineList.bind(this)});
        this.eventTypeMap.set(config.eventType.init,{fn:this.initSocket.bind(this)});
        this.isSingle = true;
        if(this.isSingle){
            storageService.clearAll();
        }
    }
    init(rootIo){
        this.rootIo = rootIo;
        if(!this.isSingle){
            //非单机模式 定时发送消息记录状态  ，并且清理已失效的socket
            let time = storageService.heartbeatListen() / 2;
            setInterval(()=>{
                let namespaces =  this.rootIo.nsps;
                for(let namespace in namespaces){
                    if(namespace == '/'){
                        return;
                    }
                    let sockets = Object.keys(this.rootIo.of(namespace).sockets);
                    storageService.saveHeartbeatTime(namespace,sockets);
                }
            },time);
        }
    }
    /****
     * 发送消息至前端
     * @param io
     * @param socket
     * @param data
     */
    sendMsg(io,socket,data){
        let emit = undefined;
        if(!data){
            return;
        }
        //发送给用户的消息
        if(data.toUser){
            if(data.toUser.socketId){
                emit =  io.to(this._getSocketId(io.name,data.toUser.socketId));
            }else if(data.toUser.uuid){
                emit = io.to(data.toUser.uuid);
            }
        }else if(data.toRoom){
            //发送给房间消息
            emit = io.to(data.toRoom.room);
        }else if(data.toNamespace){
            emit = io.to(data.toNamespace.namespace);
        }

        emit && emit.emit(data.msgType,...data.msgData);
    }

    /****
     * 加入房间
     * @param io
     * @param socket
     * @param data
     */
    join(io,socket,data){
        if(!data || !data.room){
            return;
        }
        socket.join(data.room);
        //记录加入过的房间
        let rooms = socket.get("room");
        if(!rooms){
            rooms = [];
        }
        rooms.push(data.room);
        socket.set("room",rooms);
        let uuid = socket.get("uuid");
        let user = socket.get("user");
        storageService.joinRoom(io.name,data.room,socket.id,user);
    }
    /****
     * 离开房间
     * @param io
     * @param socket
     * @param data
     */
    leave(io,socket,data){
        if(!data || !data.room){
            return;
        }
        socket.leave(data.room);
        let rooms = socket.get("room");
        if(rooms){
            let index = rooms.indexOf(data.room);
            if(index >=0){
                rooms.splice(index,1);
                socket.set("room",rooms);
            }
        }
        storageService.leaveRoom(io.name,data.room,socket.id);
    }

    /****
     * 设置用户标识
     * @param io
     * @param socket
     * @param data
     */
    setUUID(io,socket,data){
        if(!data || !data.uuid){
            return;
        }

        let oldUUId = socket.get("uuid");
        oldUUId && socket.leave(oldUUId);

        let uuid = data.uuid;
        socket.set("uuid",uuid);
        socket.join(uuid);
    }

    /****
     * 推送在线列表
     * @param io
     * @param socket
     * @param data
     */
    onlineList(io,socket,data){
        if(!data.room || !data.key){
            return;
        }
        storageService.getRoomUserList(io.name,data.room)
            .then((result)=>{
                let arr = [...result.values()];
                if(!result.has(socket.id)){
                    arr.push(socket.get("user"));
                }
                socket.emit(data.key,arr,arr.length);
            }).catch((e)=>{
                log.error(e);
            });
    }

    /****
     * 对socket进行初始化
     * @param io
     * @param socket
     * @param data
     */
    initSocket(io,socket,initData) {
        if(!initData){
            return;
        }
        let data = initData;
        if(!data){
            return;
        }
        //设置uuid，设置后续事件、断开之后事件
        if (data.uuid) {
            //设置uuid
            this.setUUID(io, socket,{uuid:data.uuid});
        }

        //设置用户信息
        if(data.user){
            socket.set("user",data.user);
        }

        if(data.event){
            //现在需要执行的消息
            if (data.event.now) {
                for (let i = 0; i < data.event.now.length; i++) {
                    let msg = data.event.now[i].msg;
                    let fn = this.eventTypeMap.get(msg.eventType);
                    fn && fn.fn(io,socket,msg.ext);
                }
            }
            //断开连接后需要
            if(data.event.disconnect){
                socket.set("disconnect",data.event.disconnect);
            }
        }
    }

    /*****
     * 断开连接
     * @param io
     * @param socket
     */
    disconnect(io,socket){
        socket.disconnect();
        let events = socket.get("disconnect");
        //执行断开后的事件
        if(events){
            for(let i = 0;i<events.length;i++){
                let data = events[i].msg;
                if(data.eventType == config.eventType.sendMsg || data.eventType == config.eventType.leave){
                    let fn = this.eventTypeMap.get(data.eventType);
                    fn && fn.fn(io,socket,data.ext);
                }
            }
        }
        //清理数据。
        let uuid = socket.get("uuid");
        let rooms = socket.get("room");
        if(rooms){
            for(let i =0;i<rooms.length;i++){
                socket.leave(rooms[i]);
                storageService.leaveRoom(io.name,rooms[i],socket.id);
            }
        }
    }

    /****
     * 根据对应消息类型 处理消息
     * @param namespace
     * @param data
     * @param isRedis
     */
    message(namespace,data,isFormRedis){
        if(!data || !namespace){
            log.error("no message namespace or data");
            return {};
        }
        let fn = this.eventTypeMap.get(data.eventType);
        if(!fn){
            log.error("unknow message type",data);
            return {};
        }
        //获取socket
        let socket = this._getSocket(namespace,data);
        if(!isFormRedis && !fn.isChat){  //!socket &&  没有找到socket
            // 并且不是redis消息 并且不是普通消息 则发送redis消息通知其他socket服务处理
            return {isNeedMultiple:true};
        }

        let namespaceIo = this.rootIo.of(namespace);
        //是普通消息  或者  找到socket  执行处理函数
        if(fn.isChat){
            fn.fn(namespaceIo,null,data.ext);
        }else if(socket){
            for(let i = 0;i<socket.length;i++){
                socket[i] && fn.fn(namespaceIo,socket[i],data.ext);
            }
        }
        return {}
    }

    _getSocket(namespace,data){
        let namespaceIo = this.rootIo.of(namespace);
        let socket = null;
        if(data.ext && data.ext.form){
            if(data.ext.form.socketId){
                socket = [namespaceIo.sockets[this._getSocketId(namespace,data.ext.form.socketId)]];//namespace"#"socketId 规则
            }else if(data.ext.uuid){
                socket = this._getSocketByUUid(namespaceIo,data.ext.form.uuid);
            }
        }
        return socket;
    }

    _getSocketByUUid(io,uuid){
        let room = io.adapter.rooms[uuid];
        if(room){
            return  room.sockets;
        }
    }
    _getSocketId(namespace,socketId){
        return namespace+"#"+socketId;
    }
}
module.exports = new MessageHandler();