'use static';
const config=require('../config/config');
const redis = require("redis");
const Q = require("Q");
class StorageService{
    constructor(){
        this.redisClient = redis.createClient({host:config.redis.host, port:config.redis.port} );
    }

    /*****
     * 存放房间用户列表
     * @param namespace
     * @param room
     * @param socketIdOrUuid
     * @param value
     */
    joinRoom(namespace,room,socketIdOrUuid,value){
        let deferred = Q.defer();
        let key = this._getRedisKey(namespace,room);
        if(!value){
            value = {};
        }
        this.redisClient.hset(key,socketIdOrUuid,JSON.stringify(value), (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    }

    /****
     * 用户退出房间
     * @param namespace
     * @param room
     * @param socketIdOrUuid
     */
    leaveRoom(namespace,room,socketIdOrUuid){
        let deferred = Q.defer();
        let key = this._getRedisKey(namespace,room);
        this.redisClient.hdel(key,socketIdOrUuid, (error, result) => {
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
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
     * @param socketIdOrUuid
     */
    getRoomUser(namespace,room,socketIdOrUuid){
        let deferred = Q.defer();
        this.redisClient.hget(this._getRedisKey(namespace,room),socketIdOrUuid, (error, result) => {
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
     * @param socketIdOrUuid
     */
    roomExistsUser(namespace,room,socketIdOrUuid){
        let deferred = Q.defer();
        this.redisClient.hexists(this._getRedisKey(namespace,room),socketIdOrUuid, (error, result) => {
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
        this.redisClient.hvals(this._getRedisKey(namespace,room),(error,result)=>{
            if(error){
                deferred.reject(error);
            }else{
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    }
    _getRedisKey(namespace,room){
        return `socket_list_by_${namespace}_${room}`;
    }
}

module.exports = new StorageService();