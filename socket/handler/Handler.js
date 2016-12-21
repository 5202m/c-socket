'use strict';
const config=require('../../config/config');
const msgpack = require('msgpack-js');
/****
 * 基本消息处理类
 *  大致流程：
 *      在socket连接成功后 获取需要监听的消息列表
 *      进行监听，监听到前端传入的消息后 通过node emit方式推送给其他服务处理
 *
 *      监听on node emit消息类型，包含发送至前端、加入房间、离开房间、设置数据等操作  由其他服务推送(aService/bService)
 *      监听消息后，对当前socket做校验，如果当前消息中包含socket则代表客直接做最终消息处理。
 *
 *      如不包含socket，包含socketId则表示非本机，则把消息推送至redis。
 *
 *
 *      订阅redis消息，监听消息后根据socketId获取socket，如获取到socket则做最终的消息处理（推送、加入......）
 *      如无获取到socket则表示当前socket不在本机，不处理
 *
 *
 */
class Handler{
    constructor(){
        this.io;
        let redis = require('redis');
        this._pub = redis.createClient({host:config.redis.host, port:config.redis.port} );
        this._sub = redis.createClient({host:config.redis.host, port:config.redis.port,
            return_buffers: true
        });
    }
    init(io){
        this.io = io;
        this.clientHandler = require("./ClientHandler");
        this.messageHandler = require("./MessageHandler");
    }
    /***
     * 连接成功，设置消息监听
     * @param socket
     */
    connection(socket){
/*        //推送连接成功消息
        this.clientHandler.message("connection",socket);
        //监听配置的消息，收到消息后以事件形式推送出去，由具体的处理类完成
        socket.on("message",(msgType,...values)=>{
            //推送消息
            this.clientHandler.message(msgType,socket, ...values);
        });
        //TODO 因页面还使用emit  待页面改为send方式时 下面代码可删除  现在需固定type接收
        let types = ["login","sendMsg","getWhMsg"];
        for(let i = 0;i<types.length;i++){
            let type = types[i];
            socket.on(type,(...values)=>{
                //推送消息
                this.clientHandler.message(type,socket, ...values);
            });
        }*/
    }

    /****
     * 断开连接
     * @param socket
     */
    disconnect(socket){
        let data = {
            socketId:socket.id,
            uuid:socket.get("uuid"),
            namespace:socket.adapter.nsp.name,
            rooms:socket.get("room"),
            user:socket.get("user")
        }
        this.clientHandler.message("disconnect",socket,data);
        this.messageHandler.disconnect(this.io.of(socket.adapter.nsp.name),socket);
    }
}

module.exports = new Handler();