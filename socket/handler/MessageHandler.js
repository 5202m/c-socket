'use strict';
const config=require('../../config/config');
const msgpack = require('msgpack-js');
const storageService = require("../../service/StorageService");
/****
 * 对消息的处理，发送消息、加入房间、离开房间
 */
class MessageHandler{
    constructor(){
        this.msgType = new Map();
        this.msgType.set(config.msgType.sendMsg,{fn:this.sendMsg.bind(this),isChat:true});
        this.msgType.set(config.msgType.join,{fn:this.join.bind(this)});
        this.msgType.set(config.msgType.leave,{fn:this.leave.bind(this)});
        this.msgType.set(config.msgType.setUUID,{fn:this.setUUID.bind(this)});
        this.msgType.set(config.msgType.init,{fn:this.initSocket.bind(this)});
    }
    init(rootIo){
        this.rootIo = rootIo;
    }
    /****
     * 发送消息至前端
     * @param io
     * @param socket
     * @param data
     */
    sendMsg(io,socket,data){
        let emit = undefined;
        let ext = data.ext;
        if(!ext){
            return;
        }
        if(ext.toUser){
            if(ext.socketId){
                emit =  io.to(io.name+"#"+ext.socketId);
            }else if(ext.uuid){
                emit = io.to(ext.uuid);
            }
        }else if(ext.room){
            emit = io.to(ext.room);
        }else if(ext.namespace){
            emit = io;
        }
        if(emit){
            emit.emit(data.sendMsgType,...data.msgData);
        }
    }

    /****
     * 加入房间
     * @param io
     * @param socket
     * @param data
     */
    join(io,socket,data){
        let ext = data.ext;
        if(!ext || !ext.room){
            return;
        }
        socket.join(ext.room);
        //记录加入过的房间
        let rooms = socket.get("room");
        if(!rooms){
            rooms = [];
        }
        rooms.push(ext.room);
        socket.set("room",rooms);
        let uuid = socket.get("uuid");
        let user = socket.get("user");
        storageService.joinRoom(io.name,ext.room,uuid || socket.id,user);
    }
    /****
     * 离开房间
     * @param io
     * @param socket
     * @param data
     */
    leave(io,socket,data){
        let ext = data.ext;
        if(!ext || !ext.room){
            return;
        }
        socket.leave(ext.room);
        let rooms = socket.get("room");
        if(rooms){
            let index = rooms.indexOf(ext.room);
            if(index >=0){
                rooms.splice(index,1);
                socket.set("room",rooms);
            }
        }
        let uuid = socket.get("uuid");
        storageService.leaveRoom(io.name,ext.room,uuid || socket.id);
    }

    /****
     * 设置用户标识
     * @param io
     * @param socket
     * @param data
     */
    setUUID(io,socket,data){
        let ext = data.ext;
        if(!ext || !ext.uuid){
            return;
        }
        let uuid = ext.uuid;
        //已存在uuid 则不处理
        if(this._getSocketByUUid(io,uuid)){
           return;
        }
        let oldUUid = socket.get("uuid");
        if(oldUUid){
            socket.leave(oldUUid);
        }
        socket.set("uuid",uuid);
        socket.join(uuid);
    }

    /****
     * 推送在线列表
     * @param io
     * @param socket
     * @param data
     */
    pushOnline(io,socket,data){
        if(!data.room || !data.key){
            return;
        }
        storageService.getRoomUserList(io.name,data.room)
            .then((result)=>{
                try{
                    var arr = [];
                    for(let i = 0;i<result.length;i++){
                        arr.push(JSON.parse(result[i]));
                    }
                    socket.emit(data.key,arr,arr.length);
                }catch (e){}
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
        let data = undefined;
        if(initData.msgData instanceof Array){
            data = initData.msgData[0];
        }else{
            data = initData.msgData;
        }
        if(!data){
            return;
        }
        //设置uuid，设置后续事件、断开之后事件
        if (data.uuid) {
            //设置uuid
            this.setUUID(io, socket,{ext:{uuid:data.uuid}});
        }

        //需要在线用户信息
        if(data.online){
            if(data.online.user){
                socket.set("user",data.online.user);
            }
        }

        if(data.event){
            //现在需要执行的消息
            if (data.event.now) {
                for (let i = 0; i < data.event.now.length; i++) {
                    let msg = data.event.now[i].msg;
                    let fn = this.msgType.get(msg.msgType);
                    fn && fn.fn(io,socket,msg);
                }
            }
            //断开连接后需要
            if(data.event.disconnect){
                socket.set("disconnect",data.event.disconnect);
            }
        }
        //需要推送在线列表
        if(data.online) {
            if (data.online.push) {
                this.pushOnline(io,socket,data.online.push);
            }
        }
    }

    /*****
     * 断开连接
     * @param io
     * @param socket
     * @param data
     */
    disconnect(io,socket,data){
        socket.disconnect();
        let events = socket.get("disconnect");
        //执行断开后的事件
        if(events){
            try{
                for(let i = 0;i<events.length;i++){
                    let msg = events[i].msg;
                    if(msg.msgType == config.msgType.sendMsg || msg.msgType == config.msgType.leave){
                        let fn = this.msgType.get(msg.msgType);
                        fn && fn.fn(io,socket,msg);
                    }
                }
            }catch (e){
                console.log(e);
            }
        }
        //清理数据。
        let uuid = socket.get("uuid");
        let rooms = socket.get("room");
        if(rooms){
            for(let i =0;i<rooms.length;i++){
                socket.leave(rooms[i]);
                storageService.leaveRoom(io.name,rooms[i],uuid || socket.id);
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
            console.error("no message namespace or data");
            return {};
        }
        let fn = this.msgType.get(data.msgType);
        if(!fn){
            console.error("unknow message type");
            return {};
        }
        if(!isFormRedis && !fn.isChat){
            //首次处理 则直接返回 通知使用redis消息统一处理
            return {isNeedMultiple:true};
        }
        try{
            let namespaceIo = this.rootIo.of(namespace);
            if(fn.isChat){
                fn.fn(namespaceIo, namespaceIo.sockets[namespace+"#"+data.ext.socketId],data);
            }else if(data.ext){
                if(data.ext.socketId){
                    let socket = namespaceIo.sockets[namespace+"#"+data.ext.socketId];//namespace"#"socketId 规则
                    socket && fn.fn(namespaceIo,socket,data);
                }else if(data.ext.uuid){
                    //根据uuid获取房间
                    let socket = this._getSocketByUUid(data.ext.uuid);
                    socket && fn.fn(namespaceIo,socket,data);
                }
            }
        }catch (e){
            console.log(e);
        }
        return {}
    }

    _getSocketByUUid(io,uuid){
        let room = io.adapter.rooms[uuid];
        if(room){
            for(let socketId in room.sockets){
                return io.sockets[socketId];
            }
        }
    }
}
module.exports = new MessageHandler();


//TODO 如果在所有服务器关闭的情况下，用户关闭页面，就会导致redis中存储信息永远不会被删除
//1：可使用SortedSet 存储 （加入时间） 定时清理加入时间超过XX小时之前的信息
//2：使用ttl 监听ttl过期回调 来清理房间缓存信息
//3：setbit 方式