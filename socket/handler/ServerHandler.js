'use strict';
const config=require('../../config/config');
const msgpack = require('msgpack-js');
const redis = require('redis');
/*****
 * 处理服务消息（由业务层面传入的消息）
 * 对消息进行redis集群扩展
 */
class ServerHandler{
    init(io){
        this.messageHandler = require("./MessageHandler");
        this.messageHandler.init(io);
        this._pub = redis.createClient({host:config.redis.host, port:config.redis.port} );
        this._sub = redis.createClient({host:config.redis.host, port:config.redis.port,
            return_buffers: true
        });
        this.listen();
    }
    /***
     * 监听emitter消息,redis消息
     */
    listen(){
        let _this = this;
        /*config.emitter.send.on(this.getEmitterKey(),(namespace,data)=>{
            _this.onMessage(namespace,data);
        });*/
        this._sub.on("ready", ()=>{
            _this._sub.on("message", (channel, message)=>{
                let data = msgpack.decode(message);
                _this.messageHandler.message(data.namespace,data,true);
            });
        });
        this._sub.subscribe(this.getRedisKey(), (err)=>{});
    }

    /****
     * 收到业务推送的消息
     * @param data
     */
    onMessage(namespace,data){
        if(data && data.msgType){
            let result = this.messageHandler.message(namespace,data,false);
            if(result.isNeedMultiple){
                data.namespace = namespace;
                this._pub.publish(this.getRedisKey(),msgpack.encode(data));
            }
        }
    }
    getRedisKey(){
        return "socket_chat_multiple";
    }
}

module.exports = new ServerHandler();