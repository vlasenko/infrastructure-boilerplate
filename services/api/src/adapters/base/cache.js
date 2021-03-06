import { redisConnection as redis } from 'io';
import logger from 'io/logger';

let hasInitialCleared = false;

export default class Cache {
  constructor (model, key = '_id', ttl = 3600) {
    this._name = model.modelName.toLowerCase();
    this._key = key;
    this._ttl = __DEV__ ? ttl : 30;
    this._purgeQueue = [];
    this._errorState = false;

    redis.on('error', () => {
      this._errorState = true;
    });

    redis.on('ready', async () => {
      if (this._errorState) {
        while (this._purgeQueue.length) {
          const key = this._purgeQueue.pop();
          try {
            await redis.delAsync(this._keyStr(key));
          } catch (e) {
            this._purgeQueue.push(key);
          }
        }
      }
    });
  }
  _keyStr (key) {
    return `${this._name}:${key.toString()}`;
  }
  // NOTE: Overriden by adapter-specific subclass
  serialize (instance) {
    return instance;
  }
  // NOTE: Overriden by adapter-specific subclass
  deserialize (object) {
    return object;
  }
  async get (key) {
    let instance = null;
    try {
      instance = await redis.getAsync(this._name, this._keyStr(key))
    } catch (err) {
      logger.trace('redis error', err);
      this._purgeQueue.push(key);
    }
    return instance;
  }
  async getMany (keys) {
    let instances = keys.map(() => null);
    try {
      instances = (await redis.mgetAsync(keys.map((key) => this._keyStr(key))))
      .map((instance) => instance ? this.deserialize(instance) : null);
    } catch (err) {
      logger.trace('redis error', err);
      this._purgeQueue = this._purgeQueue.concat(keys);
    }
    return instances;
  }
  async set (instance) {
    try {
      await redis.multi()
        .set(this._keyStr(instance[this._key]), this.serialize(instance))
        .expire(this._keyStr(instance[this._key]), this._ttl)
        .execAsync();
    } catch (e) {
      logger.trace('redis error', err);
      this._purgeQueue.push(instance[this._key]);
      return false;
    }
  }
  async setMany (instances) {
    try {
      await redis.multi(instances.map((instance) => [
        'SETEX',
        this._keyStr(instance[this._key]),
        this._ttl,
        this.serialize(instance)
      ]))
      .execAsync();
      return true;
    } catch (e) {
      logger.trace('redis error', err);
      this._purgeQueue = this._purgeQueue.concat(instances.map((instance) => instance._id));
      return false;
    }
  }
  async delete (instance) {
    try {
      await redis.delAsync(
        this._keyStr(instance[this._key] ? instance[this._key] : instance)
      );
      return true;
    } catch (e) {
      logger.trace('redis error', err);
      this._purgeQueue.push(instance[this._key]);
      return false;
    }
    return ;
  }
  async deleteMany (instances) {
    try {
      await redis.multi(instances.map((instance) => [
        'DEL',
        this._keyStr(instance[this._key])
      ]))
      .execAsync();
      return true;
    } catch (e) {
      logger.trace('redis error', err);
      this._purgeQueue = this._purgeQueue.concat(instances.map((instance) => instance._id));
      return false
    }
  }
}
