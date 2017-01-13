'use strict';
const config=require('../config/config');
const redis = require("redis");
const Q = require("q");
const log = require("../log4j/logHelper").getLogger("StorageService");
const msgpack = require('msgpack-js');
class StorageService{
    constructor(){
        this.redisClient = redis.createClient({host:config.redis.host, port:config.redis.port} );
        this._pub = redis.createClient({host:config.redis.host, port:config.redis.port} );
        this._sub = redis.createClient({host:config.redis.host, port:config.redis.port,
            return_buffers: true
        });
        //记录在线列表  订阅redis加入离开房间消息  进行存储。
        this._onlineUserMap = {};
        //为防止本地记录与redis中记录有差异（网络等不可控因素），每隔一段时间重新从redis中获取新数据
        this.spaceTime = 1000*60*30;  //30分钟
        this.lastGetTime = new Date(); //最后一次获取时间

        //订阅消息
        this._sub.on("ready", ()=>{
            this._sub.on("message", (channel, message)=>{
                let data = msgpack.decode(message);
                let namespaceMap = this._onlineUserMap[data.namespace];
                //没有对应的map 不处理 由初始化工作处理
                if(!namespaceMap){
                    return;
                }
                let userMap = namespaceMap[data.room];
                //没有对应的list 不处理 由初始化工作处理
                if(!userMap){
                    return;
                }
                if(data.join){
                    this._addUser(userMap,data.value);
                }else{
                    this._removeUser(userMap,data.socketId);
                }
            });
        });
        this._sub.subscribe(this._getRedisPubKey(), (err)=>{});
    }

    /*****
     * 存放房间用户列表
     * @param namespace
     * @param room
     * @param socketId
     * @param value
     */
    joinRoom(namespace,room,socketId,value){
        let deferred = Q.defer();
        let key = this._getRedisKey(namespace,room);
        if(!value){
            value = {};
        }
        //记录 socketId
        value.socketId = socketId;
        this.redisClient.hset(key,socketId,JSON.stringify(value), (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
                //成功加入房间后 发送redis通知
                this._pub.publish(this._getRedisPubKey(),msgpack.encode({
                    join:true,
                    namespace:namespace,
                    room:room,
                    value:value
                }));
            }
        });
        return deferred.promise;
    }

    /****
     * 用户退出房间
     * @param namespace
     * @param room
     * @param socketId
     */
    leaveRoom(namespace,room,socketId){
        let deferred = Q.defer();
        let key = this._getRedisKey(namespace,room);
        this.redisClient.hdel(key,socketId, (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
                //成功离开房间后 发送redis通知
                this._pub.publish(this._getRedisPubKey(),msgpack.encode({
                    leave:true,
                    namespace:namespace,
                    room:room,
                    socketId:socketId
                }));
            }
        });
        return deferred.promise;
    }

    /****
     * 返回房间下用户总数
     * @param namespace
     * @param room
     * @returns {*|jQuery.promise|promise|t.promise|t}
     */
    getRoomUserCount(namespace,room){
        let deferred = Q.defer();
        let userMap = this._getUserMap(namespace,room);
        if(userMap){
            deferred.resolve(userMap.list.length);
            return deferred.promise;
        }
        this.redisClient.hlen(this._getRedisKey(namespace,room), (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    }

    /****
     * 返回房间下用户信息
     * @param namespace
     * @param room
     * @param socketId
     */
    getRoomUser(namespace,room,socketId){
        let deferred = Q.defer();
        let userMap = this._getUserMap(namespace,room);
        if(userMap){
            let user = userMap.map[socketId];
            if(user){
                deferred.resolve(user);
                return deferred.promise;
            }
        }
        this.redisClient.hget(this._getRedisKey(namespace,room),socketId, (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    }

    /****
     * 房间是否存在此用户
     * @param namespace
     * @param room
     * @param socketId
     */
    roomExistsUser(namespace,room,socketId){
        let deferred = Q.defer();
        let userMap = this._getUserMap(namespace,room);
        if(userMap){
            let user = userMap.map[socketId];
            deferred.resolve(user?true:false);
            return deferred.promise;
        }
        this.redisClient.hexists(this._getRedisKey(namespace,room),socketId, (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result == 1);
            }
        });
        return deferred.promise;
    }

    /*****
     * 返回房间用户列表
     * @param namespace
     * @param room
     */
    getRoomUserList(namespace,room){
        let deferred = Q.defer();
        let userMap = this._getUserMap(namespace,room);
        //存在缓存数据  并且距离上次从redis中获取时间未达到阈值 则直接从缓存中返回
        if(userMap && (new Date().getTime() - this.lastGetTime.getTime()) < this.spaceTime){
            deferred.resolve(userMap);
            return deferred.promise;
        }else{
            if(!this._onlineUserMap[namespace]){
                this._onlineUserMap[namespace] = {};
            }
            if(!this._onlineUserMap[namespace][room]){
                this._onlineUserMap[namespace][room] = {
                    map:{},
                    list:[]
                }
            }
        }
        this.redisClient.hvals(this._getRedisKey(namespace,room),(error,result)=>{
            if(error){
                deferred.reject(error);
            }else{
                let userMap = this._onlineUserMap[namespace][room];
                userMap.map = {};
                userMap.list = [];
                for(let i = 0;i<result.length;i++){
                    let user = JSON.parse(result[i]);
                    this._addUser(userMap,user);
                }
                this.lastGetTime = new Date(); //最后一次获取时间
                deferred.resolve(userMap);
            }
        });
        return deferred.promise;
    }

    /****
     * 返回用户在线列表key
     * @param namespace
     * @param room
     * @returns {string}
     * @private
     */
    _getRedisKey(namespace,room){
        return `socket_list_by_${namespace}##${room}`;
    }

    /****
     * 返回发布订阅 加入离开消息key
     * @returns {string}
     * @private
     */
    _getRedisPubKey(){
        return "socket_publish_join_leave";
    }

    /****
     * 返回用户心跳记录
     * @private
     */
    _getRedisUserHeartbeat(){
        return `socket_user_heartbeat`;
    }

    /****
     * 返回锁key
     * @param date
     * @returns {string}
     * @private
     */
    _getRedisHeartbeatLockKey(date){
        return `socket_user_lock_${date.getDay()}_${date.getHours()}`;
    }
    /****
     * 返回用户集
     * @param namespace
     * @param room
     * @private
     */
    _getUserMap(namespace,room){
        let namespaceMap = this._onlineUserMap[namespace];
        //没有对应的map 不处理 由初始化工作处理
        if(!namespaceMap){
            return;
        }
        return namespaceMap[room];
    }

    /****
     * 保存信息
     * @param userMap
     * @param user
     * @private
     */
    _addUser(userMap,user){
        if(userMap.map[user.socketId]){
            return;
        }
        //当前总长度
        let length = userMap.list.length;
        //记录索引
        userMap.map[user.socketId] = length;
        userMap.list.push(user);
    }

    /****
     * 清除信息
     * @param userMap
     * @param socketId
     * @private
     */
    _removeUser(userMap,socketId){
        let index = userMap.map[socketId];
        delete userMap.map[socketId];
        index>=0 && userMap.list.splice(index,1);
    }
    /****
     * 清理所有缓存信息
     */
    clearAll(){
        this._onlineUserMap = {};
        this.redisClient.keys("socket_list_by_*",(error,result)=>{
            if(error){
                log.error("cleatAll error",error);
            }else if(result.length>0){
                this.redisClient.del(result);
            }
        });
        this.redisClient.del(this._getRedisUserHeartbeat());
    }

    /****
     * 用于处理socket无效清理redis中数据
     * 获取2个小时前在redis中无更新的记录 默认为已失效的数据
     */
    heartbeatListen(){
        let time = 1000*60*60*2;
        setInterval(()=>{
            //获取一个小时前无更新记录
            let date = new Date();
            let lockKey = this._getRedisHeartbeatLockKey(date);
            this.redisClient.setnx(lockKey,"lock",(error,result)=>{
               //设置成功表明当前时间并无处理
                if(error || result != 1){
                    return;
                }
                //设置过期时间
                this.redisClient.expire(lockKey,time);

                let t = date.getTime() - time;
                //返回数据为前一段到目前为止没有心跳通知。则清理redis中数据
                this.redisClient.zrangebyscore(this._getRedisUserHeartbeat(),"(0",t,(error,result)=>{
                    if(error) {
                        return;
                    }
                    let data = {};
                    for(let i = 0;i<result.length;i++) {
                        let key = result[i].split("##");
                        let namespace = key[0];
                        let socketId = key[1];
                        if (!data[namespace]) {
                            data[namespace] = [];
                        }
                        data[namespace].push(socketId);
                    }
                    for(let namespace in data){
                        let socketIds = data[namespace];
                        //得到当前命名空间下的所有room
                        this.redisClient.keys(`socket_list_by_${namespace}*`,(error,result)=>{
                            if(error){
                                return;
                            }
                            for(let j = 0;j<result.length;j++){
                                let room = result[j].split("##")[1];
                                this.redisClient.hdel(this._getRedisKey(namespace,room),...socketIds);
                            }
                        });
                    }
                });
            });
        },time);
        return  time;
    }

    /*****
     * 用于保存心跳记录
     */
    saveHeartbeatTime(namespace,socketIds){
        let max = 500;
        let saveData = [];
        let date = new Date();
        for(let i = 0;i<socketIds.length;i++){
            let key = namespace + "##" + socketIds[i];
            saveData.push(date);
            saveData.push(key);
            if((i>0 && i%max == 0) || i == socketIds.length - 1){
                this.redisClient.zadd(this._getRedisUserHeartbeat(),...saveData);
                saveData.length = 0;
            }
        }
    }
}
module.exports = new StorageService();