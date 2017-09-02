import Redis from 'ioredis';

const redis = Redis(process.env.REDIS_URL);

export default redis;