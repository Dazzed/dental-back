const S3Client = require('aws-sdk/clients/s3');

const S3 = new S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_ACCESS_KEY
});

export default S3;
